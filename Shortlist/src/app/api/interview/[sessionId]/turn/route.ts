import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getCandidateInterviewSessionFromCookieHeader,
  isCandidateInterviewSessionGuardEnabled,
} from "@/lib/candidate-interview-auth";

const schema = z.object({
  message: z.string().trim().min(1),
});

type Context = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: Request, context: Context) {
  const { sessionId } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid turn." }, { status: 400 });
  }

  const session = await prisma.interviewSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  if (session.sessionType === "COMPANY" && isCandidateInterviewSessionGuardEnabled()) {
    const candidateSession = getCandidateInterviewSessionFromCookieHeader(request.headers.get("cookie"));
    if (!candidateSession || candidateSession.sessionId !== sessionId) {
      return NextResponse.json({ error: "Unauthorized interview session access." }, { status: 401 });
    }
  }
  if (session.status === "COMPLETED") {
    return NextResponse.json({ error: "This interview is already completed." }, { status: 409 });
  }

  const lastTurn = await prisma.interviewTurn.findFirst({
    where: { sessionId },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });
  let nextOrderIndex = (lastTurn?.orderIndex ?? -1) + 1;

  await prisma.interviewTurn.create({
    data: {
      sessionId,
      speaker: "CANDIDATE",
      message: parsed.data.message,
      orderIndex: nextOrderIndex++,
    },
  });

  const reply = "Thanks. Can you walk me through a concrete example from your recent experience?";
  await prisma.interviewTurn.create({
    data: {
      sessionId,
      speaker: "INTERVIEWER",
      message: reply,
      orderIndex: nextOrderIndex,
    },
  });

  return NextResponse.json({ reply });
}
