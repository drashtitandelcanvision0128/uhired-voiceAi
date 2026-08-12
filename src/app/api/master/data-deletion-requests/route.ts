import { NextResponse } from "next/server";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim().toUpperCase();
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? "20") || 20));

  const where =
    status === "PENDING" || status === "PROCESSED" || status === "REJECTED"
      ? { status: status as "PENDING" | "PROCESSED" | "REJECTED" }
      : {};

  const [requests, total] = await Promise.all([
    prisma.dataDeletionRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.dataDeletionRequest.count({ where }),
  ]);

  return NextResponse.json({
    requests: requests.map((row) => ({
      id: row.id,
      email: row.email,
      reason: row.reason,
      status: row.status,
      clientIp: row.clientIp,
      processedAt: row.processedAt?.toISOString() ?? null,
      resultNote: row.resultNote,
      createdAt: row.createdAt.toISOString(),
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}
