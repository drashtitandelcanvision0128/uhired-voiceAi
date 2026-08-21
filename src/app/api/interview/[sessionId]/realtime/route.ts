import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildCompanyRealtimeInstructions,
  buildPracticeRealtimeInstructions,
} from "@/lib/interview-prompt";
import {
  buildCompanyInterviewerProfile,
  resolveRealtimeVoice,
} from "@/lib/interviewer-profile";
import type { InterviewerVoiceGender } from "@prisma/client";
import { createRealtimeClientSecret } from "@/lib/openai";
import { DEFAULT_INTERVIEW_DURATION_SEC } from "@/lib/constants";
import { env } from "@/lib/env";
import { interviewSessionRealtimeSelect } from "@/lib/interview-session-select";
import { withPrismaRetry } from "@/lib/prisma-retry";
import {
  getCandidateInterviewSessionFromCookieHeader,
  isCandidateInterviewSessionGuardEnabled,
} from "@/lib/candidate-interview-auth";
import { resolveSessionKeySkills } from "@/lib/session-key-skills";
import {
  pickRandomQuestionRecords,
  resolveEffectiveQuestions,
} from "@/lib/interview-questions";
import { getCachedRealtimeInstructions } from "@/lib/realtime-instruction-cache";
import { resolveInterviewLanguage } from "@/lib/interview-languages";
import {
  checkRateLimitAsync,
  getClientIpFromRequest,
  rateLimitResponse,
} from "@/lib/rate-limit";

type Context = {
  params: Promise<{ sessionId: string }>;
};

function parseVoiceGenderOverride(request: Request): Promise<InterviewerVoiceGender | undefined> {
  return request
    .json()
    .then((body: { voiceGender?: string }) => {
      if (body.voiceGender === "MALE" || body.voiceGender === "FEMALE") {
        return body.voiceGender;
      }
      return undefined;
    })
    .catch(() => undefined);
}

export async function POST(request: Request, context: Context) {
  const { sessionId } = await context.params;

  const rate = await checkRateLimitAsync(
    "interview-realtime",
    `${getClientIpFromRequest(request)}:${sessionId}`,
    30,
    10 * 60 * 1000,
  );
  if (!rate.allowed) {
    return NextResponse.json(rateLimitResponse(rate.retryAfterSec), { status: 429 });
  }

  const voiceGenderOverride = await parseVoiceGenderOverride(request);

  const session = await withPrismaRetry(() =>
    prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: interviewSessionRealtimeSelect,
    }),
  );

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

  const candidateName = session.candidateName?.trim() || session.candidate?.name?.trim() || "";
  if (!candidateName) {
    return NextResponse.json(
      { error: "Candidate must join with name before starting voice interview." },
      { status: 400 },
    );
  }

  const durationSec = Math.min(
    DEFAULT_INTERVIEW_DURATION_SEC,
    Math.max(300, session.durationMin * 60),
  );

  const allQuestions = resolveEffectiveQuestions(
    session.questions,
    session.requirement?.questions ?? [],
  );
  const mandatoryQuestions = allQuestions.filter((q) => q.isMandatory).map((q) => q.prompt);
  const optionalTopics = allQuestions.filter((q) => !q.isMandatory);
  const maxOptionalQuestions = Math.max(
    0,
    session.maxOptionalQuestions || session.requirement?.maxOptionalQuestions || 0,
  );

  const existingPicked = Array.isArray(session.pickedOptionalQuestionIds)
    ? (session.pickedOptionalQuestionIds as string[])
    : null;
  let pickedOptional = optionalTopics.filter((q) => existingPicked?.includes(q.id));
  if (!pickedOptional.length && optionalTopics.length > 0 && maxOptionalQuestions > 0) {
    pickedOptional = pickRandomQuestionRecords(optionalTopics, maxOptionalQuestions);
  }
  const optionalQuestions = pickedOptional.map((q) => q.prompt);
  const pickedOptionalQuestionIds = pickedOptional.map((q) => q.id);
  const practiceMandatoryQuestions =
    session.sessionType === "PRACTICE" ? mandatoryQuestions : [];
  const interviewAgenda =
    session.sessionType === "PRACTICE"
      ? practiceMandatoryQuestions
      : [...mandatoryQuestions, ...optionalQuestions];
  const companyName = session.companyName ?? session.company?.name ?? null;
  const interviewerProfile =
    session.sessionType === "COMPANY"
      ? buildCompanyInterviewerProfile({
          interviewerName: session.company?.interviewerName,
          interviewerVoiceGender: session.company?.interviewerVoiceGender,
          companyName,
        })
      : null;

  const interviewLanguage = resolveInterviewLanguage(
    session.requirement?.interviewLanguage,
    session.company?.interviewLanguage,
  );

  const instructions = getCachedRealtimeInstructions(
    {
      sessionId,
      sessionUpdatedAt: session.updatedAt,
      sessionType: session.sessionType,
      candidateName,
      companyName,
      interviewerDisplayName: interviewerProfile?.displayName ?? null,
      positionTitle: session.positionTitle || session.requirement?.title || null,
      domain: session.domain || session.requirement?.domain || "Interview",
      topic: session.topic || session.requirement?.topic || "Company interview",
      jobDescription: session.jobDescription || session.requirement?.jobDescription || null,
      keySkills: resolveSessionKeySkills(session, session.requirement),
      mandatoryQuestions,
      optionalQuestions,
      maxOptionalQuestions,
      durationSec,
    },
    () =>
      session.sessionType === "COMPANY"
        ? buildCompanyRealtimeInstructions({
            candidateName,
            companyName,
            interviewerDisplayName: interviewerProfile?.displayName ?? null,
            positionTitle: session.positionTitle || session.requirement?.title || null,
            domain: session.domain || session.requirement?.domain || "Interview",
            topic: session.topic || session.requirement?.topic || "Company interview",
            jobDescription: session.jobDescription || session.requirement?.jobDescription || null,
            keySkills: resolveSessionKeySkills(session, session.requirement),
            mandatoryQuestions,
            optionalQuestions,
            maxOptionalQuestions,
            durationSec,
            interviewLanguage,
          })
        : buildPracticeRealtimeInstructions({
            candidateName,
            domain: session.domain || "Interview",
            topic: session.topic || "Practice interview",
            positionTitle: session.positionTitle || session.domain || null,
            mandatoryQuestions: practiceMandatoryQuestions,
            durationSec,
            interviewLanguage,
          }),
  );

  const sessionVoice = resolveRealtimeVoice(
    voiceGenderOverride ?? interviewerProfile?.interviewerVoiceGender ?? "MALE",
  );

  try {
    const token = await createRealtimeClientSecret(instructions, {
      voice: sessionVoice,
      useElevenLabsTts: env.useElevenLabsTts,
      transcription: {
        domain: session.domain || session.requirement?.domain || "Interview",
        topic: session.topic || session.requirement?.topic || "Company interview",
        positionTitle:
          session.positionTitle ||
          session.requirement?.title ||
          (session.sessionType === "PRACTICE" ? session.domain : null),
        jobDescription: session.jobDescription || session.requirement?.jobDescription || null,
        keySkills: resolveSessionKeySkills(session, session.requirement),
        interviewQuestions: interviewAgenda,
      },
    });

    if (!token.realtimeToken) {
      return NextResponse.json(
        { error: "OpenAI realtime is not configured. Set OPENAI_API_KEY." },
        { status: 400 },
      );
    }

    await withPrismaRetry(() =>
      prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          status: "LIVE",
          ...(pickedOptionalQuestionIds.length > 0
            ? { pickedOptionalQuestionIds }
            : {}),
        },
      }),
    );

    return NextResponse.json({
      realtimeToken: token.realtimeToken,
      expiresAt: token.expiresAt,
      durationSec,
      instructions,
      interviewQuestions: interviewAgenda,
      voiceTtsProvider: env.useElevenLabsTts ? "elevenlabs" : "openai",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create realtime client secret.",
      },
      { status: 500 },
    );
  }
}
