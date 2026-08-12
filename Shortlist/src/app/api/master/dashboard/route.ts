import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { countSupportInquiriesByStatus } from "@/lib/support-inquiry-db";

function getDaysAgoStart(days: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days);
  return start;
}

type SessionTrendRow = { createdAt: Date; sessionType: string };

type TrendBucket = { label: string; total: number; practice: number; company: number };

function buildTrendBuckets(
  sessions: SessionTrendRow[],
  buckets: Array<{ start: Date; end: Date; label: string }>,
): TrendBucket[] {
  return buckets.map(({ start, end, label }) => {
    const startTs = start.getTime();
    const endTs = end.getTime();
    const bucketSessions = sessions.filter((session) => {
      const ts = new Date(session.createdAt).getTime();
      return ts >= startTs && ts < endTs;
    });

    return {
      label,
      total: bucketSessions.length,
      practice: bucketSessions.filter((session) => session.sessionType === "PRACTICE").length,
      company: bucketSessions.filter((session) => session.sessionType === "COMPANY").length,
    };
  });
}

function buildWeeklyTrend(sessions: SessionTrendRow[]): TrendBucket[] {
  const buckets = [6, 5, 4, 3, 2, 1, 0].map((daysAgo) => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - daysAgo);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    return {
      start: day,
      end: nextDay,
      label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    };
  });

  return buildTrendBuckets(sessions, buckets);
}

function buildMonthlyTrend(sessions: SessionTrendRow[]): TrendBucket[] {
  const buckets = Array.from({ length: 12 }, (_, index) => {
    const monthsAgo = 11 - index;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(1);
    start.setMonth(start.getMonth() - monthsAgo);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    return {
      start,
      end,
      label: start.toLocaleDateString(undefined, { month: "short" }),
    };
  });

  return buildTrendBuckets(sessions, buckets);
}

function buildYearlyTrend(sessions: SessionTrendRow[]): TrendBucket[] {
  const currentYear = new Date().getFullYear();
  const buckets = Array.from({ length: 5 }, (_, index) => {
    const year = currentYear - (4 - index);
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    return {
      start,
      end,
      label: String(year),
    };
  });

  return buildTrendBuckets(sessions, buckets);
}

function isEnvConfigured(value: string | undefined | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return !(
    lower.startsWith("replace-with") ||
    lower.startsWith("change-me") ||
    lower.includes("xxxxx") ||
    lower.startsWith("your_")
  );
}

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const thirtyDaysAgo = getDaysAgoStart(30);
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    fiveYearsAgo.setHours(0, 0, 0, 0);

    const totalCompanies = await prisma.company.count();
    const activeCompanies = await prisma.company.count({ where: { isActive: true } });
    const newCompanies30d = await prisma.company.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    const totalSessions = await prisma.interviewSession.count();
    const practiceSessions = await prisma.interviewSession.count({
      where: { sessionType: "PRACTICE" },
    });
    const companySessions = await prisma.interviewSession.count({
      where: { sessionType: "COMPANY" },
    });
    const liveSessions = await prisma.interviewSession.count({ where: { status: "LIVE" } });
    const readySessions = await prisma.interviewSession.count({ where: { status: "READY" } });
    const completedSessions = await prisma.interviewSession.count({ where: { status: "COMPLETED" } });
    const sessionsLast30d = await prisma.interviewSession.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });

    const verifiedPayments = await prisma.practicePayment.findMany({
      where: { status: "VERIFIED" },
      select: { amountPaise: true, candidateEmail: true, createdAt: true },
    });
    const practiceRevenue = verifiedPayments.reduce((sum, payment) => sum + payment.amountPaise / 100, 0);
    const revenueLast30d = verifiedPayments
      .filter((payment) => new Date(payment.createdAt) >= thirtyDaysAgo)
      .reduce((sum, payment) => sum + payment.amountPaise / 100, 0);
    const uniquePayingUsers = new Set(
      verifiedPayments.map((payment) => payment.candidateEmail.toLowerCase()),
    ).size;

    const promoCodesActive = await prisma.promoCode.count({ where: { isActive: true } });
    const promoRedemptions30d = await prisma.interviewSession.count({
      where: {
        sessionType: "PRACTICE",
        promoCode: { not: null, notIn: ["PREVIEW"] },
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const supportNew = await countSupportInquiriesByStatus(prisma, "NEW");

    const sessionsForTrends = await prisma.interviewSession.findMany({
      where: { createdAt: { gte: fiveYearsAgo } },
      select: { createdAt: true, sessionType: true },
    });

    const weeklyTrend = buildWeeklyTrend(sessionsForTrends);
    const monthlyTrend = buildMonthlyTrend(sessionsForTrends);
    const yearlyTrend = buildYearlyTrend(sessionsForTrends);

    const domainGroups = await prisma.interviewSession.groupBy({
      by: ["domain"],
      _count: { _all: true },
    });

    const recentSessions = await prisma.interviewSession.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        sessionType: true,
        candidateName: true,
        candidateEmail: true,
        companyName: true,
        domain: true,
        status: true,
        createdAt: true,
      },
    });

    const recentCompanies = await prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        domain: true,
        isActive: true,
        createdAt: true,
        _count: { select: { sessions: true } },
      },
    });

    const requiredChecks = [
      isEnvConfigured(process.env.DATABASE_URL),
      isEnvConfigured(process.env.OPENAI_API_KEY),
      isEnvConfigured(process.env.RAZORPAY_KEY_ID),
      isEnvConfigured(process.env.MASTER_ADMIN_EMAIL),
      isEnvConfigured(process.env.SMTP_HOST),
    ];
    const configuredChecks = requiredChecks.filter(Boolean).length;
    const systemHealthPct = Math.round((configuredChecks / requiredChecks.length) * 1000) / 10;

    const alerts: Array<{ id: string; level: "info" | "warning" | "critical"; title: string; body: string; href?: string }> = [];

    if (liveSessions > 0) {
      alerts.push({
        id: "live-sessions",
        level: "info",
        title: `${liveSessions} live session${liveSessions === 1 ? "" : "s"} right now`,
        body: "Candidates are currently in active interview rooms.",
        href: "/master/practice-sessions",
      });
    }

    if (supportNew > 0) {
      alerts.push({
        id: "support-new",
        level: "warning",
        title: `${supportNew} new support inquir${supportNew === 1 ? "y" : "ies"}`,
        body: "Unread messages from contact form or company admins need review.",
        href: "/master/support",
      });
    }

    if (systemHealthPct < 100) {
      alerts.push({
        id: "system-health",
        level: systemHealthPct < 60 ? "critical" : "warning",
        title: "System configuration incomplete",
        body: `${configuredChecks} of ${requiredChecks.length} core integrations are configured.`,
        href: "/master/system-settings",
      });
    }

    const completionRatePct =
      totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 1000) / 10 : 0;

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      metrics: {
        totalCompanies,
        activeCompanies,
        inactiveCompanies: totalCompanies - activeCompanies,
        newCompanies30d,
        totalSessions,
        practiceSessions,
        companySessions,
        liveSessions,
        readySessions,
        completedSessions,
        sessionsLast30d,
        completionRatePct,
        practiceRevenue,
        revenueLast30d,
        uniquePayingUsers,
        promoCodesActive,
        promoRedemptions30d,
        supportNew,
        systemHealthPct,
      },
      weeklyTrend,
      monthlyTrend,
      yearlyTrend,
      topDomains: domainGroups
        .map((row) => ({
          domain: row.domain || "Unknown",
          sessions: row._count._all,
        }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 6),
      recentSessions: recentSessions.map((session) => ({
        id: session.id,
        type: session.sessionType,
        name: session.candidateName ?? session.companyName ?? "Unknown",
        email: session.candidateEmail ?? "",
        domain: session.domain,
        status: session.status,
        createdAt: session.createdAt.toISOString(),
      })),
      recentCompanies: recentCompanies.map((company) => ({
        id: company.id,
        name: company.name,
        domain: company.domain,
        isActive: company.isActive,
        sessionCount: company._count.sessions,
        createdAt: company.createdAt.toISOString(),
      })),
      alerts,
    });
  } catch (error) {
    console.error("[master/dashboard]", error);
    return NextResponse.json({ error: "Unable to load dashboard." }, { status: 500 });
  }
}
