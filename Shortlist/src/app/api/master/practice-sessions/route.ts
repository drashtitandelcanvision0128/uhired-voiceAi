import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";

const VALID_STATUSES = ["READY", "LIVE", "COMPLETED"] as const;
const VALID_PAYMENTS = ["PAID", "PROMO", "UNPAID"] as const;

function parseDateParam(value: string | null, endOfDay = false): Date | undefined {
  if (!value?.trim()) return undefined;
  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) return undefined;
  if (endOfDay) {
    parsed.setHours(23, 59, 59, 999);
  }
  return parsed;
}

function buildPracticeSessionWhere(url: URL): Prisma.InterviewSessionWhereInput {
  const search = url.searchParams.get("search")?.trim() ?? "";
  const statusParam = url.searchParams.get("status")?.trim().toUpperCase() ?? "";
  const paymentParam = url.searchParams.get("payment")?.trim().toUpperCase() ?? "";
  const track = url.searchParams.get("track")?.trim() ?? "";
  const fromDate = parseDateParam(url.searchParams.get("fromDate"));
  const toDate = parseDateParam(url.searchParams.get("toDate"), true);
  const scoreMinRaw = url.searchParams.get("scoreMin");
  const scoreMaxRaw = url.searchParams.get("scoreMax");
  const scoreMin = scoreMinRaw ? Number(scoreMinRaw) : undefined;
  const scoreMax = scoreMaxRaw ? Number(scoreMaxRaw) : undefined;

  const statusFilter = VALID_STATUSES.includes(statusParam as (typeof VALID_STATUSES)[number])
    ? (statusParam as (typeof VALID_STATUSES)[number])
    : undefined;

  const paymentFilter = VALID_PAYMENTS.includes(paymentParam as (typeof VALID_PAYMENTS)[number])
    ? (paymentParam as (typeof VALID_PAYMENTS)[number])
    : undefined;

  const where: Prisma.InterviewSessionWhereInput = {
    sessionType: "PRACTICE",
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(track ? { domain: { contains: track, mode: "insensitive" } } : {}),
    ...(fromDate || toDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { candidateName: { contains: search, mode: "insensitive" } },
            { candidateEmail: { contains: search, mode: "insensitive" } },
            { domain: { contains: search, mode: "insensitive" } },
            { topic: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  if (paymentFilter === "PROMO") {
    where.promoCode = { not: null };
    where.NOT = { promoCode: "" };
  } else if (paymentFilter === "PAID") {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { OR: [{ promoCode: null }, { promoCode: "" }] },
      { practicePayment: { status: "VERIFIED" } },
    ];
  } else if (paymentFilter === "UNPAID") {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      { OR: [{ promoCode: null }, { promoCode: "" }] },
      {
        OR: [
          { practicePayment: null },
          { practicePayment: { status: { not: "VERIFIED" } } },
        ],
      },
    ];
  }

  const hasScoreMin = scoreMin !== undefined && !Number.isNaN(scoreMin);
  const hasScoreMax = scoreMax !== undefined && !Number.isNaN(scoreMax);
  if (hasScoreMin || hasScoreMax) {
    where.scorecard = {
      overallScore: {
        ...(hasScoreMin ? { gte: scoreMin } : {}),
        ...(hasScoreMax ? { lte: scoreMax } : {}),
      },
    };
  }

  return where;
}

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "10") || 10));
  const where = buildPracticeSessionWhere(url);

  const [sessions, total, activeNow, scoreAggregate, revenueAggregate] = await Promise.all([
    prisma.interviewSession.findMany({
      where,
      include: { scorecard: true, practicePayment: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.interviewSession.count({ where }),
    prisma.interviewSession.count({ where: { sessionType: "PRACTICE", status: "LIVE" } }),
    prisma.scorecard.aggregate({
      where: { session: where },
      _avg: { overallScore: true },
    }),
    prisma.practicePayment.aggregate({
      where: {
        status: "VERIFIED",
        session: where,
      },
      _sum: { amountPaise: true },
    }),
  ]);

  const rows = sessions.map((session) => ({
    id: session.id,
    candidateName: session.candidateName ?? "Unknown",
    candidateEmail: session.candidateEmail ?? "unknown@example.com",
    track: session.domain,
    status: session.status,
    durationLabel:
      session.startedAt && session.endedAt
        ? `${Math.max(0, Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000))}s`
        : `${session.durationMin}m`,
    score: session.scorecard?.overallScore ?? null,
    paymentType: session.promoCode
      ? "PROMO"
      : session.practicePayment?.status === "VERIFIED"
        ? "PAID"
        : "UNPAID",
    paymentAmountPaise: session.practicePayment?.amountPaise ?? 0,
    createdAt: session.createdAt,
  }));

  return NextResponse.json({
    metrics: {
      totalSessions: total,
      avgPerformance: scoreAggregate._avg.overallScore ?? 0,
      revenueStream: (revenueAggregate._sum.amountPaise ?? 0) / 100,
      activeNow,
    },
    rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}
