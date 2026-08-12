import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCompanyAdminSessionFromCookieHeader } from "@/lib/company-admin-auth";
import {
  syncCandidateFromSession,
  syncInterviewSessionsForCandidate,
} from "@/lib/candidate-session-sync.server";

type Context = {
  params: Promise<{ candidateId: string }>;
};

const patchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
});

export async function GET(request: Request, context: Context) {
  const authCompany = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!authCompany) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { candidateId } = await context.params;

  const candidate = await prisma.candidate.findFirst({
    where: { id: candidateId, companyId: authCompany.companyId, isArchived: false },
    include: {
      sessions: {
        where: { sessionArchivedAt: null, sessionType: "COMPANY", companyId: authCompany.companyId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          scorecard: { select: { overallScore: true } },
        },
      },
      _count: { select: { sessions: true } },
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }

  const latest = candidate.sessions[0];

  return NextResponse.json({
    candidate: {
      candidateId: candidate.id,
      name: candidate.name,
      email: candidate.email,
      createdAt: candidate.createdAt.toISOString(),
      updatedAt: candidate.updatedAt.toISOString(),
      sessionsCount: candidate._count.sessions,
      latestStatus: latest?.status ?? "READY",
      latestScore: latest?.scorecard?.overallScore ?? null,
    },
    sessions: candidate.sessions.map((s) => ({
      id: s.id,
      accessCode: s.accessCode,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      positionTitle: s.positionTitle,
      domain: s.domain,
      topic: s.topic,
      durationMin: s.durationMin,
      score: s.scorecard?.overallScore ?? null,
    })),
  });
}

export async function PATCH(request: Request, context: Context) {
  const authCompany = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!authCompany) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { candidateId } = await context.params;

  try {
    const body = patchSchema.parse(await request.json());
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.email !== undefined) data.email = body.email.toLowerCase();

    const existing = await prisma.candidate.findFirst({
      where: { id: candidateId, companyId: authCompany.companyId, isArchived: false },
      select: { id: true, email: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }

    const sessionSync: { candidateName?: string; candidateEmail?: string } = {};
    if (body.name !== undefined) sessionSync.candidateName = body.name;
    if (body.email !== undefined) sessionSync.candidateEmail = body.email.toLowerCase();

    let syncedSessions = 0;
    await prisma.$transaction(async (tx) => {
      await tx.candidate.update({ where: { id: existing.id }, data });
      syncedSessions = await syncInterviewSessionsForCandidate(tx, {
        companyId: authCompany.companyId,
        candidateId: existing.id,
        previousEmail: existing.email,
        nextEmail: body.email?.toLowerCase(),
        candidateName: sessionSync.candidateName,
        candidateEmail: sessionSync.candidateEmail,
      });
    });
    return NextResponse.json({ ok: true, syncedSessions });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update candidate." }, { status: 500 });
  }
}
