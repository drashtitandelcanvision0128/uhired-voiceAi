import { NextResponse } from "next/server";
import { z } from "zod";
import { INTERVIEW_CONSENT_VERSION } from "@/lib/interview-consent";
import { prisma } from "@/lib/prisma";
import {
  getCandidateInterviewSessionFromCookieHeader,
  isCandidateInterviewSessionGuardEnabled,
} from "@/lib/candidate-interview-auth";

type Context = {
  params: Promise<{ sessionId: string }>;
};

const bodySchema = z.object({
  accepted: z.literal(true),
  consentVersion: z.string().trim().optional(),
});

export async function POST(request: Request, context: Context) {
  try {
    const { sessionId } = await context.params;
    const body = bodySchema.parse(await request.json());

    const session = await prisma.interviewSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }
    if (session.status === "COMPLETED") {
      return NextResponse.json({ error: "This interview is already complete." }, { status: 409 });
    }

    if (session.sessionType === "COMPANY" && isCandidateInterviewSessionGuardEnabled()) {
      const candidateSession = getCandidateInterviewSessionFromCookieHeader(request.headers.get("cookie"));
      if (!candidateSession || candidateSession.sessionId !== sessionId) {
        return NextResponse.json({ error: "Unauthorized interview session access." }, { status: 401 });
      }
    }

    const consentVersion = body.consentVersion?.trim() || INTERVIEW_CONSENT_VERSION;
    const updated = await prisma.interviewSession.update({
      where: { id: sessionId },
      data: {
        consentAcceptedAt: session.consentAcceptedAt ?? new Date(),
        consentVersion: session.consentVersion ?? consentVersion,
      },
      select: { consentAcceptedAt: true, consentVersion: true },
    });

    return NextResponse.json({
      ok: true,
      consentAcceptedAt: updated.consentAcceptedAt?.toISOString(),
      consentVersion: updated.consentVersion,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to record consent." }, { status: 500 });
  }
}
