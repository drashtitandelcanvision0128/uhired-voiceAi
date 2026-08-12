import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fillMissingIdealAnswersOnRecords } from "@/lib/generate-ideal-answers";
import { resolveEffectiveQuestions, type QuestionResultRow } from "@/lib/interview-questions";
import {
  mergeQuestionGradingIntoScorecard,
  runQuestionGradingForSession,
} from "@/lib/question-grading";
import { buildScorecard, buildAiRubricScorecardAsync, getScoringModel, type DetailedScorecard } from "@/lib/scoring";
import { resolveSessionKeySkills } from "@/lib/session-key-skills";
import { resolveGradingQuestionsForSession } from "@/lib/transcript-grading-questions";

export type SessionQuestionGradingResult = {
  accuracyPercent: number;
  questionCount: number;
};

/**
 * Full per-question AI grading for a completed session. Grades every substantive
 * Q&A extracted from the transcript (not just the admin agenda list).
 */
export async function gradeCompletedSessionQuestions(
  sessionId: string,
): Promise<SessionQuestionGradingResult | null> {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId, status: "COMPLETED" },
    include: {
      transcript: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] },
      questions: { orderBy: { orderIndex: "asc" } },
      requirement: { include: { questions: { orderBy: { orderIndex: "asc" } } } },
      scorecard: true,
    },
  });

  if (!session?.transcript.length) {
    return null;
  }

  const resolvedKeySkills = resolveSessionKeySkills(session, session.requirement);
  const gradingContext = {
    role: session.positionTitle || session.requirement?.title || session.domain || "Interview",
    jobDescription: session.jobDescription || session.requirement?.jobDescription || null,
    keySkills: resolvedKeySkills,
    domain: session.domain,
    topic: session.topic,
  };

  const agendaQuestions = resolveEffectiveQuestions(
    session.questions,
    session.requirement?.questions ?? [],
  );
  const pickedOptionalIds = Array.isArray(session.pickedOptionalQuestionIds)
    ? (session.pickedOptionalQuestionIds as string[])
    : null;
  const transcriptTurns = session.transcript.map((turn) => ({
    speaker: turn.speaker,
    message: turn.message,
  }));

  const { questions: resolvedQuestions, prefilledAnswers } = await resolveGradingQuestionsForSession({
    turns: transcriptTurns,
    agendaQuestions,
    pickedOptionalIds,
  });

  const gradingQuestions = await fillMissingIdealAnswersOnRecords(resolvedQuestions, gradingContext, {
    transcriptTurns,
    concurrency: 3,
  });

  const persistedIdealUpdates = gradingQuestions.filter(
    (q) => q.expectedAnswer?.trim() && !q.id.startsWith("txq-"),
  );
  if (persistedIdealUpdates.length > 0) {
    await Promise.all(
      persistedIdealUpdates.map((q) =>
        prisma.interviewQuestion.updateMany({
          where: { id: q.id, sessionId, expectedAnswer: null },
          data: { expectedAnswer: q.expectedAnswer, difficulty: q.difficulty },
        }),
      ),
    );
  }

  if (!gradingQuestions.length) {
    return null;
  }

  const questionGrading = await runQuestionGradingForSession({
    turns: transcriptTurns,
    questions: gradingQuestions,
    role: gradingContext.role,
    keySkills: resolvedKeySkills,
    prefilledAnswers,
  });

  if (!questionGrading) {
    return null;
  }

  const finalQuestionResults: QuestionResultRow[] = questionGrading.questionResults;

  const aiHolistic = await buildAiRubricScorecardAsync({
    turns: transcriptTurns,
    domain: session.domain,
    topic: session.topic,
    positionTitle: session.positionTitle || session.requirement?.title || null,
    keySkills: resolvedKeySkills,
    mandatoryQuestions: gradingQuestions.filter((q) => q.isMandatory).map((q) => q.prompt),
  });

  const baseScore: DetailedScorecard = aiHolistic
    ? aiHolistic
    : session.scorecard
      ? {
          overallScore: session.scorecard.overallScore,
          communication: session.scorecard.communication,
          domainDepth: session.scorecard.domainDepth,
          confidence: session.scorecard.confidence,
          summary: session.scorecard.summary,
          strengths: (session.scorecard.strengths as string[]) ?? [],
          improvements: (session.scorecard.improvements as string[]) ?? [],
          evidence: (session.scorecard.evidence as string[]) ?? [],
          scoringMode: session.scorecard.scoringMode ?? "heuristic-immediate",
          scoringModel: session.scorecard.scoringModel,
        }
      : buildScorecard({
          turns: session.transcript,
          domain: session.domain,
          topic: session.topic,
          positionTitle: session.positionTitle,
          keySkills: resolvedKeySkills,
          mandatoryQuestions: gradingQuestions.filter((q) => q.isMandatory).map((q) => q.prompt),
        });

  const merged = mergeQuestionGradingIntoScorecard(baseScore, {
    ...questionGrading,
    questionResults: finalQuestionResults,
  });

  await prisma.scorecard.upsert({
    where: { sessionId },
    update: {
      overallScore: merged.overallScore,
      communication: merged.communication,
      domainDepth: merged.domainDepth,
      confidence: merged.confidence,
      summary: merged.summary,
      strengths: merged.strengths as Prisma.InputJsonValue,
      improvements: merged.improvements as Prisma.InputJsonValue,
      evidence: merged.evidence as Prisma.InputJsonValue,
      accuracyPercent: merged.accuracyPercent,
      questionResults: merged.questionResults as unknown as Prisma.InputJsonValue,
      scoringMode: aiHolistic ? "ai-rubric-question-hybrid" : "semantic-question-grade-hybrid",
      scoringModel: getScoringModel(),
    },
    create: {
      sessionId,
      overallScore: merged.overallScore,
      communication: merged.communication,
      domainDepth: merged.domainDepth,
      confidence: merged.confidence,
      summary: merged.summary,
      strengths: merged.strengths as Prisma.InputJsonValue,
      improvements: merged.improvements as Prisma.InputJsonValue,
      evidence: merged.evidence as Prisma.InputJsonValue,
      accuracyPercent: merged.accuracyPercent,
      questionResults: merged.questionResults as unknown as Prisma.InputJsonValue,
      scoringMode: aiHolistic ? "ai-rubric-question-hybrid" : "semantic-question-grade-hybrid",
      scoringModel: getScoringModel(),
    },
  });

  return {
    accuracyPercent: merged.accuracyPercent ?? 0,
    questionCount: finalQuestionResults.length,
  };
}
