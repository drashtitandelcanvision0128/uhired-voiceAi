import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "10") || 10));
  const search = url.searchParams.get("search")?.trim() ?? "";
  const statusParam = url.searchParams.get("status")?.trim().toUpperCase() ?? "";
  const validStatuses = ["READY", "LIVE", "COMPLETED", "FAILED"] as const;
  const statusFilter = validStatuses.includes(statusParam as (typeof validStatuses)[number])
    ? (statusParam as (typeof validStatuses)[number])
    : undefined;

  const where = {
    sessionType: "COMPANY" as const,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(search
      ? {
          OR: [
            { candidateName: { contains: search, mode: "insensitive" as const } },
            { candidateEmail: { contains: search, mode: "insensitive" as const } },
            { companyName: { contains: search, mode: "insensitive" as const } },
            { domain: { contains: search, mode: "insensitive" as const } },
            { positionTitle: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [sessions, total, activeNow, completedCount] = await Promise.all([
    prisma.interviewSession.findMany({
      where,
      include: {
        scorecard: true,
        company: { select: { id: true, name: true, domain: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.interviewSession.count({ where }),
    prisma.interviewSession.count({ where: { sessionType: "COMPANY", status: "LIVE" } }),
    prisma.interviewSession.count({ where: { sessionType: "COMPANY", status: "COMPLETED" } }),
  ]);

  const rows = sessions.map((session) => ({
    id: session.id,
    candidateName: session.candidateName ?? "Unknown",
    candidateEmail: session.candidateEmail ?? "unknown@example.com",
    companyName: session.companyName ?? session.company?.name ?? "—",
    companyId: session.companyId,
    positionTitle: session.positionTitle ?? session.topic,
    domain: session.domain,
    status: session.status,
    durationLabel:
      session.startedAt && session.endedAt
        ? `${Math.max(0, Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000))}s`
        : `${session.durationMin}m`,
    score: session.scorecard?.overallScore ?? null,
    createdAt: session.createdAt,
  }));

  return NextResponse.json({
    metrics: {
      totalSessions: total,
      activeNow,
      completedCount,
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
