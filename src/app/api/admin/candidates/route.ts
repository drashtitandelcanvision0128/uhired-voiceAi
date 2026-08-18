import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCompanyPermission } from "@/lib/company-admin-api";
import { ensureCompanyDecoupled } from "@/lib/decouple-backfill";
import { revealEmail, protectEmail } from "@/lib/field-encryption";
import { getCompanyAdminSessionFromCookieHeader } from "@/lib/company-admin-auth";

const deleteSchema = z.object({
  candidateId: z.string().trim().min(1),
});

const postSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email().optional(),
});

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 200;
const MAX_CANDIDATES = 500;

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const COMPANY_SESSION_WHERE = {
  sessionArchivedAt: null,
  sessionType: "COMPANY" as const,
};

type CandidateRow = Prisma.CandidateGetPayload<{
  include: {
    sessions: {
      include: { scorecard: true };
    };
    _count: { select: { sessions: true } };
  };
}>;

function serializeCandidate(c: CandidateRow) {
  const latest = c.sessions[0];
  return {
    candidateId: c.id,
    key: c.id,
    candidateName: c.name,
    candidateEmail: revealEmail(c.email),
    latestStatus: latest?.status ?? (c._count.sessions > 0 ? "READY" : "NONE"),
    latestScore: latest?.scorecard?.overallScore ?? null,
    latestSessionId: latest?.id ?? null,
    sessionsCount: c._count.sessions,
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const authCompany = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!authCompany) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureCompanyDecoupled(authCompany.companyId);

  const { searchParams } = new URL(request.url);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE));
  const search = (searchParams.get("search") ?? "").trim();
  const status = (searchParams.get("status") ?? "ALL").toUpperCase();

  const baseWhere: Prisma.CandidateWhereInput = {
    companyId: authCompany.companyId,
    isArchived: false,
  };

  const searchWhere: Prisma.CandidateWhereInput = search
    ? {
        ...baseWhere,
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }
    : baseWhere;

  const candidates = await prisma.candidate.findMany({
    where: searchWhere,
    orderBy: { updatedAt: "desc" },
    include: {
      sessions: {
        where: { ...COMPANY_SESSION_WHERE, companyId: authCompany.companyId },
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { scorecard: true },
      },
      _count: {
        select: {
          sessions: { where: { ...COMPANY_SESSION_WHERE, companyId: authCompany.companyId } },
        },
      },
    },
    take: MAX_CANDIDATES,
  });

  const allSerialized = candidates.map(serializeCandidate);

  const completedList = allSerialized.filter((c) => c.latestStatus === "COMPLETED");
  const readyList = allSerialized.filter((c) => c.latestStatus === "READY");
  const otherList = allSerialized.filter((c) => c.latestStatus !== "COMPLETED" && c.latestStatus !== "READY");

  const completedCount = completedList.length;
  const readyCount = readyList.length;
  const totalSessions = allSerialized.reduce((sum, c) => sum + c.sessionsCount, 0);
  const candidatesWithInterviews = allSerialized.filter((c) => c.sessionsCount > 0).length;
  const avgSessionsPerCandidate =
    candidatesWithInterviews > 0
      ? Math.round((totalSessions / candidatesWithInterviews) * 10) / 10
      : 0;

  const statusFiltered =
    status === "COMPLETED"
      ? completedList
      : status === "READY"
        ? readyList
        : [...completedList, ...readyList, ...otherList];

  const total = statusFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const paginated = statusFiltered.slice(start, start + pageSize);

  return NextResponse.json({
    candidates: paginated,
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
    },
    metrics: {
      total: allSerialized.length,
      completedInterview: completedCount,
      readyNotStarted: readyCount,
      avgSessionsPerCandidate,
      totalSessions,
    },
  });
}

export async function POST(request: Request) {
  const authOrResponse = await requireCompanyPermission(request, "candidates:write");
  if (authOrResponse instanceof NextResponse) return authOrResponse;
  const authCompany = authOrResponse;
  try {
    const body = postSchema.parse(await request.json());
    const candidate = await prisma.candidate.create({
      data: {
        companyId: authCompany.companyId,
        name: body.name,
        email: body.email ? protectEmail(body.email.toLowerCase()) : null,
      },
    });
    return NextResponse.json({ ok: true, candidateId: candidate.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create candidate." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authOrResponse = await requireCompanyPermission(request, "candidates:write");
  if (authOrResponse instanceof NextResponse) return authOrResponse;
  const authCompany = authOrResponse;

  try {
    const body = deleteSchema.parse(await request.json());
    const candidate = await prisma.candidate.findFirst({
      where: { id: body.candidateId, companyId: authCompany.companyId, isArchived: false },
      select: { id: true },
    });
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.interviewSession.updateMany({
        where: { companyId: authCompany.companyId, candidateId: candidate.id, sessionType: "COMPANY" },
        data: { candidateId: null },
      });
      await tx.candidate.update({
        where: { id: candidate.id },
        data: { isArchived: true },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to delete candidate entry." }, { status: 500 });
  }
}
