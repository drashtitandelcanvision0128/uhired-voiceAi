import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveElevenLabsVoiceId, synthesizeElevenLabsSpeech } from "@/lib/elevenlabs";
import { env } from "@/lib/env";
import {
  getCandidateInterviewSessionFromCookieHeader,
  isCandidateInterviewSessionGuardEnabled,
} from "@/lib/candidate-interview-auth";

const schema = z.object({
  text: z.string().trim().min(1).max(8_000),
  voiceGender: z.enum(["MALE", "FEMALE"]).optional(),
});

type Context = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: Request, context: Context) {
  if (!env.useElevenLabsTts) {
    return NextResponse.json({ error: "ElevenLabs TTS is not enabled." }, { status: 400 });
  }

  const { sessionId } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid TTS request." }, { status: 400 });
  }

  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    select: { id: true, status: true, sessionType: true },
  });
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

  try {
    const voiceId = resolveElevenLabsVoiceId(parsed.data.voiceGender);
    const { audio, contentType } = await synthesizeElevenLabsSpeech(parsed.data.text, voiceId);
    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to synthesize speech.",
      },
      { status: 502 },
    );
  }
}
