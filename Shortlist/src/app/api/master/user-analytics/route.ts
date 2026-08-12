import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";

type UserType = "PRACTICE" | "COMPANY_CANDIDATE" | "INVITED" | "COMPANY_ADMIN";

type UserAccumulator = {
  email: string;
  name: string;
  types: Set<UserType>;
  sessionCount: number;
  completedCount: number;
  practiceCount: number;
  companyCount: number;
  scores: number[];
  domains: Map<string, number>;
  firstSeenAt: Date;
  lastActiveAt: Date;
  companies: Set<string>;
};

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

function upsertUser(
  map: Map<string, UserAccumulator>,
  email: string,
  patch: Partial<UserAccumulator> & { type?: UserType; name?: string; domain?: string; company?: string },
) {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  const existing =
    map.get(normalized) ??
    ({
      email: normalized,
      name: patch.name?.trim() || normalized,
      types: new Set<UserType>(),
      sessionCount: 0,
      completedCount: 0,
      practiceCount: 0,
      companyCount: 0,
      scores: [],
      domains: new Map<string, number>(),
      firstSeenAt: patch.firstSeenAt ?? new Date(),
      lastActiveAt: patch.lastActiveAt ?? new Date(),
      companies: new Set<string>(),
    } satisfies UserAccumulator);

  if (patch.name?.trim()) {
    existing.name = patch.name.trim();
  }
  if (patch.type) {
    existing.types.add(patch.type);
  }
  if (patch.sessionCount) {
    existing.sessionCount += patch.sessionCount;
  }
  if (patch.completedCount) {
    existing.completedCount += patch.completedCount;
  }
  if (patch.practiceCount) {
    existing.practiceCount += patch.practiceCount;
  }
  if (patch.companyCount) {
    existing.companyCount += patch.companyCount;
  }
  if (patch.scores?.length) {
    existing.scores.push(...patch.scores);
  }
  if (patch.domain) {
    existing.domains.set(patch.domain, (existing.domains.get(patch.domain) ?? 0) + 1);
  }
  if (patch.company) {
    existing.companies.add(patch.company);
  }
  if (patch.firstSeenAt && patch.firstSeenAt < existing.firstSeenAt) {
    existing.firstSeenAt = patch.firstSeenAt;
  }
  if (patch.lastActiveAt && patch.lastActiveAt > existing.lastActiveAt) {
    existing.lastActiveAt = patch.lastActiveAt;
  }

  map.set(normalized, existing);
}

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "25") || 25));
    const search = url.searchParams.get("search")?.trim().toLowerCase() ?? "";
    const typeFilter = url.searchParams.get("type")?.trim().toUpperCase() as UserType | "ALL" | undefined;

    const sessions = await prisma.interviewSession.findMany({
      select: {
        sessionType: true,
        status: true,
        candidateName: true,
        candidateEmail: true,
        domain: true,
        companyName: true,
        createdAt: true,
        scorecard: { select: { overallScore: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const companies = await prisma.company.findMany({
      select: {
        name: true,
        adminEmail: true,
        isActive: true,
        createdAt: true,
      },
    });

    const invites = await prisma.requirementInvite.findMany({
      select: {
        email: true,
        usedAt: true,
        createdAt: true,
      },
    });

    const rosterCandidates = await prisma.candidate.findMany({
      select: {
        name: true,
        email: true,
        createdAt: true,
        company: { select: { name: true } },
      },
    });

    const userMap = new Map<string, UserAccumulator>();

    for (const session of sessions) {
      const email = normalizeEmail(session.candidateEmail);
      if (!email) continue;

      const isPractice = session.sessionType === "PRACTICE";
      upsertUser(userMap, email, {
        name: session.candidateName ?? undefined,
        type: isPractice ? "PRACTICE" : "COMPANY_CANDIDATE",
        sessionCount: 1,
        completedCount: session.status === "COMPLETED" ? 1 : 0,
        practiceCount: isPractice ? 1 : 0,
        companyCount: isPractice ? 0 : 1,
        scores: session.scorecard ? [session.scorecard.overallScore] : [],
        domain: session.domain,
        company: session.companyName ?? undefined,
        firstSeenAt: session.createdAt,
        lastActiveAt: session.createdAt,
      });
    }

    for (const company of companies) {
      upsertUser(userMap, company.adminEmail, {
        type: "COMPANY_ADMIN",
        company: company.name,
        firstSeenAt: company.createdAt,
        lastActiveAt: company.createdAt,
      });
    }

    for (const invite of invites) {
      upsertUser(userMap, invite.email, {
        type: "INVITED",
        firstSeenAt: invite.createdAt,
        lastActiveAt: invite.usedAt ?? invite.createdAt,
      });
    }

    for (const candidate of rosterCandidates) {
      const email = normalizeEmail(candidate.email);
      if (!email) continue;
      upsertUser(userMap, email, {
        name: candidate.name,
        type: "COMPANY_CANDIDATE",
        company: candidate.company.name,
        firstSeenAt: candidate.createdAt,
        lastActiveAt: candidate.createdAt,
      });
    }

    const users = Array.from(userMap.values());
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const practiceUsers = users.filter((user) => user.types.has("PRACTICE")).length;
    const companyCandidates = users.filter((user) => user.types.has("COMPANY_CANDIDATE")).length;
    const companyAdmins = users.filter((user) => user.types.has("COMPANY_ADMIN")).length;
    const invitedUsers = users.filter((user) => user.types.has("INVITED")).length;
    const returningUsers = users.filter((user) => user.sessionCount >= 2).length;
    const activeLast30Days = users.filter((user) => user.lastActiveAt.getTime() >= thirtyDaysAgo).length;

    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((session) => session.status === "COMPLETED").length;
    const practiceSessions = sessions.filter((session) => session.sessionType === "PRACTICE").length;
    const companySessions = sessions.filter((session) => session.sessionType === "COMPANY").length;

    const practiceOnly = users.filter(
      (user) => user.types.has("PRACTICE") && !user.types.has("COMPANY_CANDIDATE"),
    ).length;
    const companyOnly = users.filter(
      (user) => user.types.has("COMPANY_CANDIDATE") && !user.types.has("PRACTICE"),
    ).length;
    const bothPracticeAndCompany = users.filter(
      (user) => user.types.has("PRACTICE") && user.types.has("COMPANY_CANDIDATE"),
    ).length;

    const domainTotals = new Map<string, { users: Set<string>; sessions: number }>();
    for (const session of sessions) {
      const email = normalizeEmail(session.candidateEmail);
      if (!email) continue;
      const entry = domainTotals.get(session.domain) ?? { users: new Set<string>(), sessions: 0 };
      entry.users.add(email);
      entry.sessions += 1;
      domainTotals.set(session.domain, entry);
    }

    const topDomains = Array.from(domainTotals.entries())
      .map(([domain, stats]) => ({
        domain,
        users: stats.users.size,
        sessions: stats.sessions,
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8);

    const weeklyNewUsers = [6, 5, 4, 3, 2, 1, 0].map((daysAgo) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - daysAgo);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);

      const count = users.filter((user) => {
        const firstSeen = user.firstSeenAt;
        return firstSeen >= day && firstSeen < nextDay;
      }).length;

      return {
        label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        count,
      };
    });

    const userRows = users
      .map((user) => {
        const primaryDomain =
          Array.from(user.domains.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
        const avgScore =
          user.scores.length > 0
            ? Math.round(user.scores.reduce((sum, score) => sum + score, 0) / user.scores.length)
            : null;

        return {
          email: user.email,
          name: user.name,
          types: Array.from(user.types),
          sessionCount: user.sessionCount,
          completedCount: user.completedCount,
          practiceCount: user.practiceCount,
          companyCount: user.companyCount,
          avgScore,
          primaryTrack: primaryDomain,
          companies: Array.from(user.companies),
          firstSeenAt: user.firstSeenAt.toISOString(),
          lastActiveAt: user.lastActiveAt.toISOString(),
          isReturning: user.sessionCount >= 2,
        };
      })
      .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());

    const filteredUsers = userRows.filter((user) => {
      const matchesSearch =
        !search ||
        user.email.toLowerCase().includes(search) ||
        user.name.toLowerCase().includes(search) ||
        user.primaryTrack.toLowerCase().includes(search) ||
        user.companies.some((company) => company.toLowerCase().includes(search));
      const matchesType =
        !typeFilter || typeFilter === "ALL" || user.types.includes(typeFilter);
      return matchesSearch && matchesType;
    });

    const totalUsers = filteredUsers.length;
    const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginatedUsers = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize);

    return NextResponse.json({
      summary: {
        totalUniqueUsers: users.length,
        practiceUsers,
        companyCandidates,
        companyAdmins,
        invitedUsers,
        returningUsers,
        activeLast30Days,
        completionRatePct:
          totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 1000) / 10 : 0,
      },
      userTypeBreakdown: {
        practiceOnly,
        companyOnly,
        bothPracticeAndCompany,
        adminsOnly: users.filter(
          (user) =>
            user.types.has("COMPANY_ADMIN") &&
            !user.types.has("PRACTICE") &&
            !user.types.has("COMPANY_CANDIDATE"),
        ).length,
      },
      sessionBreakdown: {
        total: totalSessions,
        practice: practiceSessions,
        company: companySessions,
        completed: completedSessions,
        live: sessions.filter((session) => session.status === "LIVE").length,
        ready: sessions.filter((session) => session.status === "READY").length,
      },
      weeklyNewUsers,
      topDomains,
      users: paginatedUsers,
      pagination: {
        page: safePage,
        pageSize,
        total: totalUsers,
        totalPages,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load user analytics." }, { status: 500 });
  }
}
