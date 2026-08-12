import { NextResponse } from "next/server";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { prisma } from "@/lib/prisma";

type Context = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(request: Request, context: Context) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, sessionType: "PRACTICE" },
    include: {
      transcript: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] },
      scorecard: true,
      scoringJobs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Practice session not found." }, { status: 404 });
  }

  return NextResponse.json({
    session: {
      id: session.id,
      candidateName: session.candidateName,
      candidateEmail: session.candidateEmail,
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
    where: { id: sessionId, sessionType: "PRACTICE" },
    select: { id: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Practice session not found." }, { status: 404 });
  }

  await prisma.interviewSession.delete({ where: { id: session.id } });
  return NextResponse.json({ ok: true });
}
