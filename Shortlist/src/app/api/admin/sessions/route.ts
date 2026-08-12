import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompanyAdminSessionFromCookieHeader } from "@/lib/company-admin-auth";
import { formatInterviewDurationShort } from "@/lib/interview-duration";
import { getInterviewVideoRecordingStatuses } from "@/lib/interview-video-storage";
import {
  buildCandidateInviteCodeMap,
  resolveCandidateInviteCode,
} from "@/lib/requirement-invite-lookup";
import { resolveSessionCandidateDisplay } from "@/lib/candidate-session-display";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNumberParam(value: string | null) {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function parseDateParam(value: string | null, mode: "start" | "end") {
  if (!value) return null;
  // Accept YYYY-MM-DD or ISO.
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return mode === "start" ? startOfUtcDay(parsed) : endOfUtcDay(parsed);
}

function buildSessionWhere(
  companyId: string,
  status: string,
  search: string,
  filters: {
    minScore: number | null;
    maxScore: number | null;
    fromDate: Date | null;
    toDate: Date | null;
  },
): Prisma.InterviewSessionWhereInput {
  const base: Prisma.InterviewSessionWhereInput = {
    sessionType: "COMPANY",
    companyId,
  };

  const withStatus =
    status && status !== "ALL"
      ? { ...base, status: status as Prisma.EnumSessionStatusFilter["equals"] }
      : base;

  let where: Prisma.InterviewSessionWhereInput = withStatus;

  if (filters.fromDate || filters.toDate) {
    where = {
      ...where,
      createdAt: {
        ...(filters.fromDate ? { gte: filters.fromDate } : {}),
        ...(filters.toDate ? { lte: filters.toDate } : {}),
      },
    };
  }

  if (filters.minScore != null || filters.maxScore != null) {
    where = {
      ...where,
      scorecard: {
        is: {
          overallScore: {
            ...(filters.minScore != null ? { gte: filters.minScore } : {}),
            ...(filters.maxScore != null ? { lte: filters.maxScore } : {}),
          },
        },
      },
    };
  }

  const trimmed = search.trim();
  if (!trimmed) return where;

  return {
    ...where,
    OR: [
      { positionTitle: { contains: trimmed, mode: "insensitive" } },
      { domain: { contains: trimmed, mode: "insensitive" } },
      { topic: { contains: trimmed, mode: "insensitive" } },
      { candidateName: { contains: trimmed, mode: "insensitive" } },
      { requirement: { accessCode: { contains: trimmed, mode: "insensitive" } } },
      {
        AND: [
          { requirementId: { not: null } },
          {
            requirement: {
              invites: {
                some: { accessCode: { contains: trimmed, mode: "insensitive" } },
              },
            },
          },
        ],
      },
    ],
  };
}

type SessionRow = Prisma.InterviewSessionGetPayload<{
  include: {
    scorecard: { select: { overallScore: true } };
    requirement: { select: { accessCode: true } };
    candidate: { select: { name: true; email: true } };
  };
}>;

function serializeSessionForList(
  session: SessionRow,
  videoRecordingStatus: "AVAILABLE" | "NOT_UPLOADED",
  inviteCodeMap: Map<string, string>,
) {
  const candidateInviteCode = resolveCandidateInviteCode(
    inviteCodeMap,
    session.requirementId,
    session.candidateEmail,
  );
  const display = resolveSessionCandidateDisplay(session);
  return {
    id: session.id,
    accessCode: session.accessCode,
    requirementAccessCode: session.requirement?.accessCode ?? null,
    candidateInviteCode,
    candidateName: display.candidateName,
    candidateEmail: display.candidateEmail,
    positionTitle: session.positionTitle,
    domain: session.domain,
    topic: session.topic,
    durationMin: session.durationMin,
    status: session.status,
    createdAt: session.createdAt.toISOString(),
    scorecard: session.scorecard ? { overallScore: session.scorecard.overallScore } : null,
    transcript: [],
    videoRecordingStatus,
    interviewDurationDisplay: formatInterviewDurationShort({
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationMin: session.durationMin,
      videoDurationSec: null,
    }),
  };
}

export async function GET(request: Request) {
  try {
    const authCompany = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
    if (!authCompany) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE));
    const status = (searchParams.get("status") ?? "ALL").toUpperCase();
    const search = searchParams.get("search") ?? "";
    const minScore = parseNumberParam(searchParams.get("minScore"));
    const maxScore = parseNumberParam(searchParams.get("maxScore"));
    const fromDate = parseDateParam(searchParams.get("from"), "start");
    const toDate = parseDateParam(searchParams.get("to"), "end");

    const companyBaseWhere: Prisma.InterviewSessionWhereInput = {
      sessionType: "COMPANY",
      companyId: authCompany.companyId,
    };
    const filteredWhere = buildSessionWhere(authCompany.companyId, status, search, {
      minScore,
      maxScore,
      fromDate,
      toDate,
    });
    const recentLimit = Math.min(
      MAX_PAGE_SIZE,
      parsePositiveInt(searchParams.get("recentLimit"), 0),
    );
    const sessionInclude = {
      scorecard: { select: { overallScore: true } },
      requirement: { select: { accessCode: true } },
      candidate: { select: { name: true, email: true } },
    } as const;

    // Read-only queries — no transaction needed. Using $transaction here can hit
    // P2028 on small Supabase pools when the dev server holds other connections.
    const [total, sessions, statusGroups] = await Promise.all([
      prisma.interviewSession.count({ where: filteredWhere }),
      prisma.interviewSession.findMany({
        where: filteredWhere,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: sessionInclude,
      }),
      prisma.interviewSession.groupBy({
        by: ["status"],
        where: companyBaseWhere,
        _count: { _all: true },
      }),
    ]);

    const recentSessions =
      recentLimit > 0
        ? await prisma.interviewSession.findMany({
            where: companyBaseWhere,
            orderBy: { createdAt: "desc" },
            take: recentLimit,
            include: sessionInclude,
          })
        : [];

    const countByStatus = new Map(statusGroups.map((group) => [group.status, group._count._all]));
    const readyCount = countByStatus.get("READY") ?? 0;
    const liveCount = countByStatus.get("LIVE") ?? 0;
    const completedCount = countByStatus.get("COMPLETED") ?? 0;
    const totalAll = statusGroups.reduce((sum, group) => sum + group._count._all, 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const videoStatuses = await getInterviewVideoRecordingStatuses([
      ...sessions.map((session) => session.id),
      ...recentSessions.map((session) => session.id),
    ]);

    const allListedSessions = [...sessions, ...recentSessions];
    const requirementIds = [
      ...new Set(allListedSessions.map((session) => session.requirementId).filter(Boolean)),
    ] as string[];
    const emails = [
      ...new Set(
        allListedSessions
          .map((session) => session.candidateEmail?.toLowerCase())
          .filter((email): email is string => Boolean(email)),
      ),
    ];
    const invites =
      requirementIds.length > 0 && emails.length > 0
        ? await prisma.requirementInvite.findMany({
            where: {
              companyId: authCompany.companyId,
              requirementId: { in: requirementIds },
              email: { in: emails },
            },
            select: { requirementId: true, email: true, accessCode: true },
          })
        : [];
    const inviteCodeMap = buildCandidateInviteCodeMap(invites);

    return NextResponse.json({
      sessions: sessions.map((session) =>
        serializeSessionForList(session, videoStatuses.get(session.id) ?? "NOT_UPLOADED", inviteCodeMap),
      ),
      recentSessions:
        recentLimit > 0
          ? recentSessions.map((session) =>
              serializeSessionForList(session, videoStatuses.get(session.id) ?? "NOT_UPLOADED", inviteCodeMap),
            )
          : undefined,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
      statusCounts: {
        total: totalAll,
        ready: readyCount,
        live: liveCount,
        completed: completedCount,
        open: readyCount + liveCount,
      },
    });
  } catch (error) {
    console.error("[admin/sessions] GET failed:", error);
    const message =
      error instanceof Error && /column .* does not exist/i.test(error.message)
        ? "Database schema is out of date. Redeploy so migrations can run, or run prisma migrate deploy."
        : error instanceof Error
          ? error.message
          : "Unable to load sessions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
