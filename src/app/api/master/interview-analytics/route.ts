import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";

type AnalyticsPeriod = "7d" | "30d" | "90d" | "all";

function getPeriodStart(period: AnalyticsPeriod) {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days);
  return start;
}

function buildWeeklyBuckets(weeks: number) {
  return Array.from({ length: weeks }, (_, index) => {
    const weeksAgo = weeks - 1 - index;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - weeksAgo * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return {
      start,
      end,
      label: start.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    };
  });
}

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const period = (url.searchParams.get("period")?.trim() ?? "30d") as AnalyticsPeriod;
    const periodStart = getPeriodStart(period);
    const createdSince = periodStart ? { createdAt: { gte: periodStart } } : {};

    const [
      totalRequirements,
      requirementsInPeriod,
      totalInvites,
      invitesInPeriod,
      totalCompanySessions,
      sessionsInPeriod,
      completedInPeriod,
      liveNow,
      companies,
      recentRequirements,
      recentSessions,
    ] = await Promise.all([
      prisma.requirement.count({ where: { isArchived: false } }),
      prisma.requirement.count({ where: { isArchived: false, ...createdSince } }),
      prisma.requirementInvite.count(),
      prisma.requirementInvite.count({ where: createdSince }),
      prisma.interviewSession.count({ where: { sessionType: "COMPANY" } }),
      prisma.interviewSession.count({ where: { sessionType: "COMPANY", ...createdSince } }),
      prisma.interviewSession.count({
        where: { sessionType: "COMPANY", status: "COMPLETED", ...createdSince },
      }),
      prisma.interviewSession.count({ where: { sessionType: "COMPANY", status: "LIVE" } }),
      prisma.company.findMany({
        select: {
          id: true,
          name: true,
          domain: true,
          isActive: true,
          _count: {
            select: {
              requirements: { where: { isArchived: false } },
              sessions: { where: { sessionType: "COMPANY" } },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.requirement.findMany({
        where: { isArchived: false, ...createdSince },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          title: true,
          domain: true,
          durationMin: true,
          createdAt: true,
          company: { select: { name: true } },
          _count: { select: { invites: true, sessions: true } },
        },
      }),
      prisma.interviewSession.findMany({
        where: { sessionType: "COMPANY", ...createdSince },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          candidateName: true,
          candidateEmail: true,
          status: true,
          positionTitle: true,
          createdAt: true,
          company: { select: { name: true } },
          scorecard: { select: { overallScore: true } },
        },
      }),
    ]);

    const companyIds = companies.map((c) => c.id);
    const [inviteCountsByCompany, sessionCountsByCompany] = await Promise.all([
      companyIds.length
        ? prisma.requirementInvite.groupBy({
            by: ["companyId"],
            where: { companyId: { in: companyIds }, ...createdSince },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      companyIds.length
        ? prisma.interviewSession.groupBy({
            by: ["companyId"],
            where: {
              companyId: { in: companyIds },
              sessionType: "COMPANY",
              status: "COMPLETED",
              ...createdSince,
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const invitesByCompany = new Map(inviteCountsByCompany.map((r) => [r.companyId, r._count._all]));
    const completedByCompany = new Map(sessionCountsByCompany.map((r) => [r.companyId, r._count._all]));

    const requirementTrendSource = await prisma.requirement.findMany({
      where: { isArchived: false, createdAt: { gte: buildWeeklyBuckets(8)[0]?.start ?? new Date() } },
      select: { createdAt: true },
    });
    const sessionTrendSource = await prisma.interviewSession.findMany({
      where: {
        sessionType: "COMPANY",
        createdAt: { gte: buildWeeklyBuckets(8)[0]?.start ?? new Date() },
      },
      select: { createdAt: true },
    });

    const buckets = buildWeeklyBuckets(8);
    const requirementTrend = buckets.map(({ start, end, label }) => ({
      label,
      count: requirementTrendSource.filter((row) => {
        const ts = row.createdAt.getTime();
        return ts >= start.getTime() && ts < end.getTime();
      }).length,
    }));
    const sessionTrend = buckets.map(({ start, end, label }) => ({
      label,
      count: sessionTrendSource.filter((row) => {
        const ts = row.createdAt.getTime();
        return ts >= start.getTime() && ts < end.getTime();
      }).length,
    }));

    const companyRows = companies
      .map((company) => ({
        companyId: company.id,
        companyName: company.name,
        domain: company.domain,
        isActive: company.isActive,
        totalRequirements: company._count.requirements,
        totalSessions: company._count.sessions,
        invitesInPeriod: invitesByCompany.get(company.id) ?? 0,
        completedInPeriod: completedByCompany.get(company.id) ?? 0,
      }))
      .sort((a, b) => b.totalSessions - a.totalSessions || b.totalRequirements - a.totalRequirements);

    return NextResponse.json({
      period,
      summary: {
        totalRequirements,
        requirementsInPeriod,
        totalInvites,
        invitesInPeriod,
        totalCompanySessions,
        sessionsInPeriod,
        completedInPeriod,
        liveNow,
        completionRatePct:
          sessionsInPeriod > 0 ? Math.round((completedInPeriod / sessionsInPeriod) * 100) : 0,
      },
      trends: {
        requirementsCreated: requirementTrend,
        sessionsConducted: sessionTrend,
      },
      companyRows,
      recentRequirements: recentRequirements.map((r) => ({
        id: r.id,
        companyName: r.company.name,
        roleTitle: r.title?.trim() || r.domain,
        durationMin: r.durationMin,
        invitesCount: r._count.invites,
        sessionsCount: r._count.sessions,
        createdAt: r.createdAt.toISOString(),
      })),
      recentSessions: recentSessions.map((s) => ({
        id: s.id,
        companyName: s.company?.name ?? null,
        candidateName: s.candidateName,
        candidateEmail: s.candidateEmail,
        positionTitle: s.positionTitle,
        status: s.status,
        overallScore: s.scorecard?.overallScore ?? null,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[master/interview-analytics GET]", error);
    return NextResponse.json({ error: "Unable to load interview analytics." }, { status: 500 });
  }
}
