import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAdminSessionFromCookieHeader } from "@/lib/company-admin-auth";
import { formatInterviewDurationShort } from "@/lib/interview-duration";
import {
  buildCandidateInviteCodeMap,
  resolveCandidateInviteCode,
} from "@/lib/requirement-invite-lookup";
import { resolveSessionCandidateDisplay } from "@/lib/candidate-session-display";

export type DashboardPeriod = "7d" | "30d" | "month" | "year";

const VALID_PERIODS: DashboardPeriod[] = ["7d", "30d", "month", "year"];

function scoreBucket(score: number): string {
  if (score <= 50) return "0–50%";
  if (score <= 70) return "51–70%";
  if (score <= 85) return "71–85%";
  return "86–100%";
}

const SCORE_BUCKET_ORDER = ["0–50%", "51–70%", "71–85%", "86–100%"];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getPeriodRange(period: DashboardPeriod): {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  label: string;
} {
  const now = new Date();
  const end = endOfDay(now);

  if (period === "7d") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 6);
    const prevEnd = startOfDay(new Date(start));
    prevEnd.setMilliseconds(-1);
    const prevStart = startOfDay(new Date(prevEnd));
    prevStart.setDate(prevStart.getDate() - 6);
    return { start, end, prevStart, prevEnd, label: "Last 7 days" };
  }

  if (period === "30d") {
    const start = startOfDay(new Date(now));
    start.setDate(start.getDate() - 29);
    const prevEnd = startOfDay(new Date(start));
    prevEnd.setMilliseconds(-1);
    const prevStart = startOfDay(new Date(prevEnd));
    prevStart.setDate(prevStart.getDate() - 29);
    return { start, end, prevStart, prevEnd, label: "Last 30 days" };
  }

  if (period === "month") {
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const prevEnd = startOfDay(new Date(start));
    prevEnd.setMilliseconds(-1);
    const prevStart = startOfDay(new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1));
    const monthName = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    return { start, end, prevStart, prevEnd, label: monthName };
  }

  const start = startOfDay(new Date(now.getFullYear(), 0, 1));
  const prevEnd = startOfDay(new Date(start));
  prevEnd.setMilliseconds(-1);
  const prevStart = startOfDay(new Date(prevEnd.getFullYear(), 0, 1));
  return { start, end, prevStart, prevEnd, label: String(now.getFullYear()) };
}

function buildTrendBuckets(
  period: DashboardPeriod,
  start: Date,
  end: Date,
): Array<{ key: string; label: string }> {
  const buckets: Array<{ key: string; label: string }> = [];

  if (period === "year") {
    const year = start.getFullYear();
    for (let m = 0; m < 12; m += 1) {
      const d = new Date(year, m, 1);
      buckets.push({
        key: monthKey(d),
        label: d.toLocaleDateString(undefined, { month: "short" }),
      });
    }
    return buckets;
  }

  const cursor = startOfDay(new Date(start));
  const last = startOfDay(new Date(end));
  while (cursor <= last) {
    const key = dayKey(cursor);
    buckets.push({
      key,
      label:
        period === "7d"
          ? cursor.toLocaleDateString(undefined, { weekday: "short" })
          : cursor.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export async function GET(request: Request) {
  try {
    const authCompany = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
    if (!authCompany) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawPeriod = searchParams.get("period") ?? "30d";
    const period = VALID_PERIODS.includes(rawPeriod as DashboardPeriod)
      ? (rawPeriod as DashboardPeriod)
      : "30d";

    const companyId = authCompany.companyId;
    const sessionWhere = { sessionType: "COMPANY" as const, companyId };
    const { start, end, prevStart, prevEnd, label: periodLabel } = getPeriodRange(period);
    const periodSessionWhere = { ...sessionWhere, createdAt: { gte: start, lte: end } };
    const prevPeriodSessionWhere = { ...sessionWhere, createdAt: { gte: prevStart, lte: prevEnd } };

    const [
      allStatusGroups,
      periodStatusGroups,
      candidatesCount,
      requirementsCount,
      allInvites,
      periodInvites,
      prevPeriodInvites,
      periodCompletedSessions,
      prevPeriodCompleted,
      periodSessions,
      prevPeriodSessionCount,
      roleSessions,
      recentSessions,
      periodNewCandidates,
      savedOpenings,
    ] = await Promise.all([
      prisma.interviewSession.groupBy({
        by: ["status"],
        where: sessionWhere,
        _count: { _all: true },
      }),
      prisma.interviewSession.groupBy({
        by: ["status"],
        where: periodSessionWhere,
        _count: { _all: true },
      }),
      prisma.candidate.count({ where: { companyId, isArchived: false } }),
      prisma.requirement.count({ where: { companyId, isArchived: false } }),
      prisma.requirementInvite.findMany({
        where: { companyId },
        select: { emailSentAt: true, usedAt: true, createdAt: true },
      }),
      prisma.requirementInvite.findMany({
        where: { companyId, createdAt: { gte: start, lte: end } },
        select: { emailSentAt: true, usedAt: true },
      }),
      prisma.requirementInvite.findMany({
        where: { companyId, createdAt: { gte: prevStart, lte: prevEnd } },
        select: { emailSentAt: true, usedAt: true },
      }),
      prisma.interviewSession.findMany({
        where: { ...periodSessionWhere, status: "COMPLETED" },
        select: { scorecard: { select: { overallScore: true } }, createdAt: true },
      }),
      prisma.interviewSession.findMany({
        where: { ...prevPeriodSessionWhere, status: "COMPLETED" },
        select: { scorecard: { select: { overallScore: true } } },
      }),
      prisma.interviewSession.findMany({
        where: periodSessionWhere,
        select: { createdAt: true, status: true },
      }),
      prisma.interviewSession.count({ where: prevPeriodSessionWhere }),
      prisma.interviewSession.findMany({
        where: sessionWhere,
        select: {
          positionTitle: true,
          domain: true,
          scorecard: { select: { overallScore: true } },
        },
      }),
      prisma.interviewSession.findMany({
        where: sessionWhere,
        orderBy: { createdAt: "desc" },
        take: 6,
        include: {
          scorecard: { select: { overallScore: true } },
          requirement: { select: { accessCode: true } },
          candidate: { select: { name: true, email: true } },
        },
      }),
      prisma.candidate.count({
        where: { companyId, isArchived: false, createdAt: { gte: start, lte: end } },
      }),
      prisma.requirement.findMany({
        where: { companyId, isArchived: false },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          title: true,
          domain: true,
          _count: { select: { sessions: true } },
        },
      }),
    ]);

    const allCountByStatus = new Map(allStatusGroups.map((g) => [g.status, g._count._all]));
    const periodCountByStatus = new Map(periodStatusGroups.map((g) => [g.status, g._count._all]));

    const allReady = allCountByStatus.get("READY") ?? 0;
    const allLive = allCountByStatus.get("LIVE") ?? 0;
    const allCompleted = allCountByStatus.get("COMPLETED") ?? 0;
    const allTotal = allStatusGroups.reduce((sum, g) => sum + g._count._all, 0);

    const periodReady = periodCountByStatus.get("READY") ?? 0;
    const periodLive = periodCountByStatus.get("LIVE") ?? 0;
    const periodCompletedCount = periodCountByStatus.get("COMPLETED") ?? 0;
    const periodTotal = periodSessions.length;

    const periodScores = periodCompletedSessions
      .map((s) => s.scorecard?.overallScore)
      .filter((s): s is number => typeof s === "number");
    const averageScore =
      periodScores.length > 0
        ? Math.round(periodScores.reduce((a, b) => a + b, 0) / periodScores.length)
        : null;

    const prevScores = prevPeriodCompleted
      .map((s) => s.scorecard?.overallScore)
      .filter((s): s is number => typeof s === "number");
    const prevAverageScore =
      prevScores.length > 0
        ? Math.round(prevScores.reduce((a, b) => a + b, 0) / prevScores.length)
        : null;

    const bucketCounts = new Map(SCORE_BUCKET_ORDER.map((b) => [b, 0]));
    for (const score of periodScores) {
      const bucket = scoreBucket(score);
      bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
    }

    const trendBuckets = buildTrendBuckets(period, start, end);
    const createdCounts = new Map(trendBuckets.map((b) => [b.key, 0]));
    const completedCounts = new Map(trendBuckets.map((b) => [b.key, 0]));

    for (const session of periodSessions) {
      const key = period === "year" ? monthKey(session.createdAt) : dayKey(session.createdAt);
      if (createdCounts.has(key)) {
        createdCounts.set(key, (createdCounts.get(key) ?? 0) + 1);
      }
    }
    for (const session of periodCompletedSessions) {
      const key = period === "year" ? monthKey(session.createdAt) : dayKey(session.createdAt);
      if (completedCounts.has(key)) {
        completedCounts.set(key, (completedCounts.get(key) ?? 0) + 1);
      }
    }

    const roleMap = new Map<string, { count: number; scores: number[] }>();
    for (const session of roleSessions) {
      const role = (session.positionTitle ?? session.domain).trim() || "Unspecified";
      const entry = roleMap.get(role) ?? { count: 0, scores: [] };
      entry.count += 1;
      if (typeof session.scorecard?.overallScore === "number") {
        entry.scores.push(session.scorecard.overallScore);
      }
      roleMap.set(role, entry);
    }
    const topRoles = [...roleMap.entries()]
      .map(([role, { count, scores: roleScores }]) => ({
        role,
        count,
        avgScore:
          roleScores.length > 0
            ? Math.round(roleScores.reduce((a, b) => a + b, 0) / roleScores.length)
            : null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const seenRoles = new Set(topRoles.map((row) => row.role.trim().toLowerCase()));
    for (const opening of savedOpenings) {
      if (topRoles.length >= 5) break;
      const role = (opening.title?.trim() || opening.domain.trim() || "Untitled opening");
      const key = role.toLowerCase();
      if (seenRoles.has(key)) continue;
      seenRoles.add(key);
      topRoles.push({
        role,
        count: opening._count.sessions,
        avgScore: null,
      });
    }

    const allInvitesSent = allInvites.filter((i) => i.emailSentAt).length;
    const allInvitesUsed = allInvites.filter((i) => i.usedAt).length;

    const periodInvitesSent = periodInvites.filter((i) => i.emailSentAt).length;
    const periodInvitesUsed = periodInvites.filter((i) => i.usedAt).length;
    const prevPeriodInvitesSent = prevPeriodInvites.filter((i) => i.emailSentAt).length;

    const inviteConversionRate =
      periodInvitesSent > 0 ? Math.round((periodInvitesUsed / periodInvitesSent) * 100) : 0;

    const completionRate =
      periodTotal > 0 ? Math.round((periodCompletedCount / periodTotal) * 100) : 0;

    const utilizationRate =
      allInvitesSent > 0
        ? Math.round((allInvitesUsed / allInvitesSent) * 100)
        : allTotal > 0
          ? Math.round((allCompleted / allTotal) * 100)
          : 0;

    const requirementIds = [
      ...new Set(recentSessions.map((s) => s.requirementId).filter(Boolean)),
    ] as string[];
    const emails = [
      ...new Set(
        recentSessions
          .map((s) => s.candidateEmail?.toLowerCase())
          .filter((e): e is string => Boolean(e)),
      ),
    ];
    const recentInvites =
      requirementIds.length > 0 && emails.length > 0
        ? await prisma.requirementInvite.findMany({
            where: {
              companyId,
              requirementId: { in: requirementIds },
              email: { in: emails },
            },
            select: { requirementId: true, email: true, accessCode: true },
          })
        : [];
    const inviteCodeMap = buildCandidateInviteCodeMap(recentInvites);

    return NextResponse.json({
      period,
      periodLabel,
      range: { start: start.toISOString(), end: end.toISOString() },
      statusCounts: {
        total: allTotal,
        ready: allReady,
        live: allLive,
        completed: allCompleted,
        open: allReady + allLive,
      },
      periodCounts: {
        total: periodTotal,
        ready: periodReady,
        live: periodLive,
        completed: periodCompletedCount,
        open: periodReady + periodLive,
      },
      candidatesCount,
      newCandidatesInPeriod: periodNewCandidates,
      requirementsCount,
      invites: {
        total: allInvites.length,
        sent: allInvitesSent,
        used: allInvitesUsed,
        pending: Math.max(0, allInvitesSent - allInvitesUsed),
      },
      periodInvites: {
        total: periodInvites.length,
        sent: periodInvitesSent,
        used: periodInvitesUsed,
        pending: Math.max(0, periodInvitesSent - periodInvitesUsed),
        conversionRate: inviteConversionRate,
      },
      averageScore,
      prevAverageScore,
      completionRate,
      utilizationRate,
      scoreBuckets: SCORE_BUCKET_ORDER.map((lbl) => ({
        label: lbl,
        count: bucketCounts.get(lbl) ?? 0,
      })),
      sessionsTrend: trendBuckets.map((b) => ({
        date: b.key,
        label: b.label,
        created: createdCounts.get(b.key) ?? 0,
        completed: completedCounts.get(b.key) ?? 0,
      })),
      comparisons: {
        sessionsCreated: {
          current: periodTotal,
          previous: prevPeriodSessionCount,
          deltaPct: deltaPct(periodTotal, prevPeriodSessionCount),
        },
        invitesSent: {
          current: periodInvitesSent,
          previous: prevPeriodInvitesSent,
          deltaPct: deltaPct(periodInvitesSent, prevPeriodInvitesSent),
        },
        averageScore: {
          current: averageScore,
          previous: prevAverageScore,
          deltaPct:
            averageScore != null && prevAverageScore != null
              ? deltaPct(averageScore, prevAverageScore)
              : null,
        },
      },
      topRoles,
      recentSessions: recentSessions.map((session) => {
        const display = resolveSessionCandidateDisplay(session);
        const candidateInviteCode = resolveCandidateInviteCode(
          inviteCodeMap,
          session.requirementId,
          session.candidateEmail,
        );
        return {
          id: session.id,
          candidateName: display.candidateName,
          positionTitle: session.positionTitle,
          domain: session.domain,
          status: session.status,
          createdAt: session.createdAt.toISOString(),
          candidateInviteCode,
          requirementAccessCode: session.requirement?.accessCode ?? null,
          scorecard: session.scorecard ? { overallScore: session.scorecard.overallScore } : null,
          interviewDurationDisplay: formatInterviewDurationShort({
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            durationMin: session.durationMin,
            videoDurationSec: null,
          }),
        };
      }),
    });
  } catch (error) {
    console.error("[admin/dashboard] GET failed:", error);
    const message = error instanceof Error ? error.message : "Unable to load dashboard.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
