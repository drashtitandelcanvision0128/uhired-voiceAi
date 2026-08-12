import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { groupSupportInquiriesByStatus, listSupportInquiries } from "@/lib/support-inquiry-db";

type ReportPeriod = "7d" | "30d" | "90d" | "all";

function getPeriodStart(period: ReportPeriod) {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days);
  return start;
}

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const period = (url.searchParams.get("period")?.trim() ?? "30d") as ReportPeriod;
    const periodStart = getPeriodStart(period);
    const sessionWhere = periodStart ? { createdAt: { gte: periodStart } } : {};
    const supportWhere = periodStart ? { createdAt: { gte: periodStart } } : {};
    const paymentWhere = periodStart
      ? { status: "VERIFIED" as const, createdAt: { gte: periodStart } }
      : { status: "VERIFIED" as const };

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setHours(0, 0, 0, 0);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);

    // Sequential reads to avoid exhausting small Supabase pooler limits.
    const totalCompanies = await prisma.company.count();
    const activeCompanies = await prisma.company.count({ where: { isActive: true } });
    const totalSessions = await prisma.interviewSession.count({ where: sessionWhere });
    const practiceSessions = await prisma.interviewSession.count({
      where: { sessionType: "PRACTICE", ...sessionWhere },
    });
    const companySessions = await prisma.interviewSession.count({
      where: { sessionType: "COMPANY", ...sessionWhere },
    });
    const completedSessions = await prisma.interviewSession.count({
      where: { status: "COMPLETED", ...sessionWhere },
    });
    const liveSessions = await prisma.interviewSession.count({ where: { status: "LIVE" } });
    const verifiedPayments = await prisma.practicePayment.findMany({
      where: paymentWhere,
      select: { amountPaise: true, candidateEmail: true, createdAt: true },
    });
    const promoCodes = await prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
      select: { code: true, durationMin: true, isActive: true, createdAt: true },
    });
    const supportInquiries = await listSupportInquiries(prisma, {
      where: supportWhere,
      take: 50,
    });
    const companies = await prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        name: true,
        domain: true,
        adminEmail: true,
        isActive: true,
        createdAt: true,
        _count: { select: { sessions: true } },
      },
    });
    const recentPractice = await prisma.interviewSession.findMany({
      where: { sessionType: "PRACTICE", ...sessionWhere },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        candidateName: true,
        candidateEmail: true,
        domain: true,
        status: true,
        durationMin: true,
        promoCode: true,
        createdAt: true,
        scorecard: { select: { overallScore: true } },
      },
    });
    const domainGroups = await prisma.interviewSession.groupBy({
      by: ["domain"],
      where: sessionWhere,
      _count: { _all: true },
    });
    const supportByStatus = await groupSupportInquiriesByStatus(prisma, periodStart);
    const trendSessions = await prisma.interviewSession.findMany({
      where: { createdAt: { gte: twelveMonthsAgo } },
      select: { createdAt: true },
    });
    const promoRedemptions = await prisma.interviewSession.count({
      where: {
        sessionType: "PRACTICE",
        promoCode: { not: null, notIn: ["PREVIEW"] },
        ...sessionWhere,
      },
    });

    const practiceRevenue = verifiedPayments.reduce((sum, payment) => sum + payment.amountPaise / 100, 0);
    const uniquePayingUsers = new Set(verifiedPayments.map((payment) => payment.candidateEmail.toLowerCase())).size;

    const weeklyTrend = [6, 5, 4, 3, 2, 1, 0].map((daysAgo) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - daysAgo);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      const label = day.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const start = day.getTime();
      const end = nextDay.getTime();
      const count = trendSessions.filter((session) => {
        const ts = new Date(session.createdAt).getTime();
        return ts >= start && ts < end;
      }).length;
      return { label, count };
    });

    const topDomains = domainGroups
      .map((row) => ({
        domain: row.domain,
        sessions: row._count._all,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10);

    const periodLabels: Record<ReportPeriod, string> = {
      "7d": "Last 7 days",
      "30d": "Last 30 days",
      "90d": "Last 90 days",
      all: "All time",
    };

    return NextResponse.json({
      meta: {
        generatedAt: new Date().toISOString(),
        period,
        periodLabel: periodLabels[period],
        periodStart: periodStart?.toISOString() ?? null,
        appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
      },
      summary: {
        totalCompanies,
        activeCompanies,
        totalSessions,
        practiceSessions,
        companySessions,
        completedSessions,
        liveSessions,
        completionRatePct:
          totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 1000) / 10 : 0,
        practiceRevenue,
        uniquePayingUsers,
        promoCodesActive: promoCodes.filter((promo) => promo.isActive).length,
        promoRedemptions,
        supportInquiries: supportInquiries.length,
        supportNew: supportByStatus.find((row) => row.status === "NEW")?._count._all ?? 0,
      },
      weeklyTrend,
      sessionTrendTimestamps: trendSessions.map((session) => session.createdAt.toISOString()),
      topDomains,
      companies: companies.map((company) => ({
        name: company.name,
        domain: company.domain,
        adminEmail: company.adminEmail,
        isActive: company.isActive,
        totalSessions: company._count.sessions,
        createdAt: company.createdAt.toISOString(),
      })),
      practiceHighlights: recentPractice.map((session) => ({
        candidateName: session.candidateName ?? "Unknown",
        candidateEmail: session.candidateEmail ?? "",
        domain: session.domain,
        status: session.status,
        durationMin: session.durationMin,
        paymentType: session.promoCode ? "PROMO" : "PAID",
        score: session.scorecard?.overallScore ?? null,
        createdAt: session.createdAt.toISOString(),
      })),
      promoCodes: promoCodes.map((promo) => ({
        code: promo.code,
        durationMin: promo.durationMin,
        isActive: promo.isActive,
        createdAt: promo.createdAt.toISOString(),
      })),
      supportInquiries: supportInquiries.map((inquiry) => ({
        name: inquiry.name,
        email: inquiry.email,
        subject: inquiry.subject,
        source: inquiry.source,
        status: inquiry.status,
        createdAt: inquiry.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[master/reports]", error);
    return NextResponse.json({ error: "Unable to generate report." }, { status: 500 });
  }
}
