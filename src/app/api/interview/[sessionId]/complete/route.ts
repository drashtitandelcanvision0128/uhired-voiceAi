import { NextResponse, after } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildScorecard, getScoringModel } from "@/lib/scoring";
import { resolveSessionKeySkills } from "@/lib/session-key-skills";
import { gradeCompletedSessionQuestions } from "@/lib/session-question-grading";
import type { TurnSpeaker } from "@prisma/client";
import { withPrismaRetry } from "@/lib/prisma-retry";
import {
  getCandidateInterviewSessionFromCookieHeader,
  isCandidateInterviewSessionGuardEnabled,
} from "@/lib/candidate-interview-auth";

type Context = {
  params: Promise<{ sessionId: string }>;
};

/** AI question grading may run for several minutes before the response returns. */
export const maxDuration = 300;

const transcriptItemSchema = z.object({
  speaker: z.enum(["interviewer", "candidate", "INTERVIEWER", "CANDIDATE"]),
  text: z.string(),
  orderIndex: z.number().int().min(0).optional(),
  timestampMs: z.number().int().min(0).optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

const completeBodySchema = z.object({
  durationSec: z.number().min(0).optional(),
  transcript: z.array(transcriptItemSchema).optional(),
});

function normalizeSpeaker(raw: string): TurnSpeaker {
  const upper = raw.toUpperCase();
  return upper === "INTERVIEWER" ? "INTERVIEWER" : "CANDIDATE";
}

async function mergeClientTranscript(
  sessionId: string,
  transcript: z.infer<typeof completeBodySchema>["transcript"],
) {
  if (!transcript?.length) return;
  const rows = transcript
    .map((item, index) => ({
      sessionId,
      speaker: normalizeSpeaker(item.speaker),
      message: item.text.trim(),
      orderIndex: item.orderIndex ?? index,
      timestampMs: item.timestampMs ?? null,
      transcriptionConfidence: item.confidence ?? null,
    }))
    .filter((row) => row.message.length > 0);
  await withPrismaRetry(() =>
    prisma.$transaction(
      async (tx) => {
        await tx.interviewTurn.deleteMany({ where: { sessionId } });
        if (rows.length > 0) {
          await tx.interviewTurn.createMany({ data: rows });
        }
      },
      { maxWait: 15000, timeout: 60000 },
    ),
  );
}

export async function POST(request: Request, context: Context) {
  const { sessionId } = await context.params;

  const session = await withPrismaRetry(() =>
    prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        sessionType: true,
        status: true,
        startedAt: true,
        companyId: true,
        requirementId: true,
        candidateName: true,
        candidateEmail: true,
        domain: true,
        topic: true,
        positionTitle: true,
        jobDescription: true,
        keySkills: true,
        questions: {
          orderBy: { orderIndex: "asc" },
          select: {
            id: true,
            prompt: true,
            isMandatory: true,
            orderIndex: true,
            expectedAnswer: true,
            gradingRubric: true,
            difficulty: true,
          },
        },
        requirement: {
          select: {
            title: true,
            domain: true,
            topic: true,
            jobDescription: true,
            keySkills: true,
            questions: {
              orderBy: { orderIndex: "asc" },
              select: {
                id: true,
                prompt: true,
                isMandatory: true,
                orderIndex: true,
                expectedAnswer: true,
                gradingRubric: true,
                difficulty: true,
              },
            },
          },
        },
        company: {
          select: {
            atsWebhookUrl: true,
            atsWebhookSecret: true,
          },
        },
      },
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
    return NextResponse.json({ ok: true, alreadyFinalized: true });
  }
  const contentType = request.headers.get("content-type") ?? "";
  let body: z.infer<typeof completeBodySchema> = {};
  if (contentType.includes("application/json")) {
    try {
      const raw = (await request.json()) as unknown;
      const parsed = completeBodySchema.safeParse(raw);
      if (parsed.success) {
        body = parsed.data;
      }
    } catch {
      // keep defaults
    }
  }

  await mergeClientTranscript(sessionId, body.transcript);

  const turnsForScoring = await prisma.interviewTurn.findMany({
    where: { sessionId },
    orderBy: [{ orderIndex: "asc" }, { id: "asc" }],
  });

  const mandatoryQuestions = (session.questions.length ? session.questions : (session.requirement?.questions ?? []))
    .filter((q) => q.isMandatory)
    .map((q) => q.prompt);

  const resolvedKeySkills = resolveSessionKeySkills(session, session.requirement);

  const scoreInput = {
    turns: turnsForScoring,
    domain: session.domain,
    topic: session.topic,
    positionTitle: session.positionTitle || session.requirement?.title || null,
    keySkills: resolvedKeySkills,
    mandatoryQuestions,
  };

  const score = buildScorecard(scoreInput);
  const scoringMode = score.scoringMode ?? "heuristic-immediate";
  const scoringModel = score.scoringModel;

  // Prefer client interview-clock elapsed over wall clock so admin duration matches
  // the allocated slot / recording metadata (not connect + upload overhead).
  const startedAt = session.startedAt ?? new Date();
  const endedAt =
    body.durationSec != null && Number.isFinite(body.durationSec)
      ? new Date(startedAt.getTime() + Math.round(body.durationSec) * 1000)
      : new Date();

  const scoringJob = await withPrismaRetry(() =>
    prisma.$transaction(async (tx) => {
      await tx.interviewSession.update({
        where: { id: sessionId },
        data: {
          status: "COMPLETED",
          endedAt,
          startedAt,
          ...(resolvedKeySkills.length > 0 ? { keySkills: resolvedKeySkills } : {}),
        },
      });

      const scorecardData = {
        overallScore: score.overallScore,
        communication: score.communication,
        domainDepth: score.domainDepth,
        confidence: score.confidence,
        summary: score.summary,
        strengths: score.strengths as Prisma.InputJsonValue,
        improvements: score.improvements as Prisma.InputJsonValue,
        evidence: score.evidence as Prisma.InputJsonValue,
        scoringMode,
        scoringModel,
      };

      await tx.scorecard.upsert({
        where: { sessionId },
        update: scorecardData,
        create: {
          sessionId,
          ...scorecardData,
        },
      });

      return tx.scoringBatchJob.create({
        data: {
          sessionId,
          status: "PENDING",
          inputPayload: {
            ...scoreInput,
            scoringModel: getScoringModel(),
          },
        },
      });
    }),
  );

  let finalScore = score;
  let gradingPending = false;
  let gradingErrorMessage: string | null = null;
  let accuracyPercent: number | null = null;
  let questionResults: unknown = null;

  try {
    await gradeCompletedSessionQuestions(sessionId);
    const refreshed = await prisma.scorecard.findUnique({
      where: { sessionId },
      select: {
        overallScore: true,
        communication: true,
        domainDepth: true,
        confidence: true,
        summary: true,
        strengths: true,
        improvements: true,
        evidence: true,
        scoringMode: true,
        scoringModel: true,
        accuracyPercent: true,
        questionResults: true,
      },
    });
    if (refreshed) {
      finalScore = {
        overallScore: refreshed.overallScore,
        communication: refreshed.communication,
        domainDepth: refreshed.domainDepth,
        confidence: refreshed.confidence,
        summary: refreshed.summary,
        strengths: (refreshed.strengths as string[]) ?? [],
        improvements: (refreshed.improvements as string[]) ?? [],
        evidence: (refreshed.evidence as string[]) ?? [],
        scoringMode: refreshed.scoringMode ?? "ai-rubric-question-hybrid",
        scoringModel: refreshed.scoringModel,
      };
      accuracyPercent = refreshed.accuracyPercent;
      questionResults = refreshed.questionResults;
    }
    await prisma.scoringBatchJob.update({
      where: { id: scoringJob.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        resultPayload: {
          overallScore: finalScore.overallScore,
          scoringMode: finalScore.scoringMode,
          accuracyPercent,
        },
      },
    });
  } catch (gradingError) {
    gradingPending = true;
    gradingErrorMessage =
      gradingError instanceof Error ? gradingError.message : "AI grading failed.";
    console.error("[interview-complete] synchronous question grading failed:", gradingError);
    await prisma.scoringBatchJob
      .update({
        where: { id: scoringJob.id },
        data: {
          status: "FAILED",
          error: gradingErrorMessage,
          completedAt: new Date(),
        },
      })
      .catch(() => null);

    // Keep a background retry so recruiters still get AI analysis if the sync path timed out.
    after(async () => {
      try {
        await gradeCompletedSessionQuestions(sessionId);
        await prisma.scoringBatchJob.updateMany({
          where: { id: scoringJob.id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
            error: null,
          },
        });
      } catch (retryError) {
        console.error("[interview-complete] background grading retry failed:", retryError);
      }
    });
  }

  if (session.company?.atsWebhookUrl) {
    after(async () => {
      const { dispatchAtsWebhook } = await import("@/lib/ats-webhook");
      await dispatchAtsWebhook({
        webhookUrl: session.company!.atsWebhookUrl!,
        secret: session.company!.atsWebhookSecret,
        payload: {
          event: "interview.completed",
          sessionId,
          companyId: session.companyId,
          candidateName: session.candidateName,
          candidateEmail: session.candidateEmail,
          requirementId: session.requirementId,
          positionTitle: session.positionTitle,
          status: "COMPLETED",
          overallScore: finalScore.overallScore,
          completedAt: endedAt.toISOString(),
        },
      });
    });
  }

  return NextResponse.json({
    ok: true,
    score: finalScore,
    gradingPending,
    accuracyPercent,
    questionResults,
    ...(gradingErrorMessage ? { gradingError: gradingErrorMessage } : {}),
  });
}
