import { NextResponse } from "next/server";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { prisma } from "@/lib/prisma";
import { writePlatformAuditLog } from "@/lib/platform-audit-log";

type Context = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(request: Request, context: Context) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, sessionType: "COMPANY" },
    include: {
      transcript: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] },
      scorecard: true,
      company: { select: { id: true, name: true, domain: true } },
      scoringJobs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Company session not found." }, { status: 404 });
  }

  return NextResponse.json({
    session: {
      id: session.id,
      candidateName: session.candidateName,
      candidateEmail: session.candidateEmail,
      companyName: session.companyName ?? session.company?.name ?? null,
      positionTitle: session.positionTitle,
      status: session.status,
      domain: session.domain,
      topic: session.topic,
      durationMin: session.durationMin,
      createdAt: session.createdAt,
      scorecard: session.scorecard,
      scoringJobStatus: session.scoringJobs[0]?.status ?? null,
      transcript: session.transcript,
    },
  });
}

export async function DELETE(request: Request, context: Context) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, sessionType: "COMPANY" },
    select: { id: true, candidateEmail: true, companyName: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Company session not found." }, { status: 404 });
  }

  await prisma.interviewSession.delete({ where: { id: session.id } });

  await writePlatformAuditLog(prisma, {
    level: "WARNING",
    category: "SESSION",
    title: "Company session deleted",
    message: `Master admin deleted company interview session for ${session.candidateEmail ?? "unknown candidate"}.`,
    metadata: { sessionId: session.id, company: session.companyName ?? "" },
  });

  return NextResponse.json({ ok: true });
}
