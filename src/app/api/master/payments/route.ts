import { NextResponse } from "next/server";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "10") || 10));
    const status = url.searchParams.get("status")?.trim().toUpperCase();
    const search = url.searchParams.get("search")?.trim() ?? "";

    const where: {
      status?: "CREATED" | "VERIFIED" | "FAILED";
      OR?: Array<Record<string, { contains: string; mode: "insensitive" }>>;
    } = {};
    if (status && status !== "ALL" && (status === "CREATED" || status === "VERIFIED" || status === "FAILED")) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { candidateName: { contains: search, mode: "insensitive" } },
        { candidateEmail: { contains: search, mode: "insensitive" } },
        { orderId: { contains: search, mode: "insensitive" } },
        { domain: { contains: search, mode: "insensitive" } },
        { promoCode: { contains: search, mode: "insensitive" } },
      ];
    }

    const [payments, total, verifiedAgg, failedCount, createdCount] = await Promise.all([
      prisma.practicePayment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          session: { select: { id: true, status: true, sessionType: true } },
        },
      }),
      prisma.practicePayment.count({ where }),
      prisma.practicePayment.aggregate({
        where: { status: "VERIFIED" },
        _sum: { amountPaise: true },
        _count: { _all: true },
      }),
      prisma.practicePayment.count({ where: { status: "FAILED" } }),
      prisma.practicePayment.count({ where: { status: "CREATED" } }),
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const revenue30d = await prisma.practicePayment.aggregate({
      where: { status: "VERIFIED", createdAt: { gte: thirtyDaysAgo } },
      _sum: { amountPaise: true },
    });

    return NextResponse.json({
      summary: {
        totalPayments: total,
        verifiedCount: verifiedAgg._count._all,
        verifiedRevenue: (verifiedAgg._sum.amountPaise ?? 0) / 100,
        revenueLast30d: (revenue30d._sum.amountPaise ?? 0) / 100,
        failedCount,
        pendingCount: createdCount,
      },
      payments: payments.map((payment) => ({
        id: payment.id,
        orderId: payment.orderId,
        paymentId: payment.paymentId,
        amount: payment.amountPaise / 100,
        currency: payment.currency,
        status: payment.status,
        candidateName: payment.candidateName,
        candidateEmail: payment.candidateEmail,
        domain: payment.domain,
        topic: payment.topic,
        durationMin: payment.durationMin,
        promoCode: payment.promoCode,
        sessionId: payment.sessionId,
        sessionStatus: payment.session?.status ?? null,
        createdAt: payment.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load payments." }, { status: 500 });
  }
}
