/**
 * Persist question grading + ideal answers for a completed session (same as POST /regrade).
 * Usage: npx tsx scripts/backfill-session-grading.mjs <sessionId>
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const root = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(root, "..", ".env") });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const sessionId = process.argv[2];

async function main() {
  if (!sessionId) {
    console.error("Usage: npx tsx scripts/backfill-session-grading.mjs <sessionId>");
    process.exit(1);
  }

  const { fillMissingIdealAnswersOnRecords } = await import("../src/lib/generate-ideal-answers.ts");
  const { resolveEffectiveQuestions } = await import("../src/lib/interview-questions.ts");
  const { resolveGradingQuestionsForSession } = await import(
    "../src/lib/transcript-grading-questions.ts"
  );
  const {
    mergeQuestionGradingIntoScorecard,
    runQuestionGradingForSession,
  } = await import("../src/lib/question-grading.ts");
  const { buildScorecard, getScoringModel } = await import("../src/lib/scoring.ts");
  const { resolveSessionKeySkills } = await import("../src/lib/session-key-skills.ts");

  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: {
      transcript: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] },
      questions: { orderBy: { orderIndex: "asc" } },
      requirement: { include: { questions: { orderBy: { orderIndex: "asc" } } } },
      scorecard: true,
    },
  });
  if (!session) throw new Error("session not found");
  if (session.status !== "COMPLETED") throw new Error("session not completed");
  if (!session.transcript.length) throw new Error("no transcript");

  const keySkills = resolveSessionKeySkills(session, session.requirement);
  const ctx = {
    role: session.positionTitle || session.requirement?.title || session.domain || "Interview",
    jobDescription: session.jobDescription || session.requirement?.jobDescription,
    keySkills,
    domain: session.domain,
    topic: session.topic,
  };

  const agendaQuestions = resolveEffectiveQuestions(
    session.questions,
    session.requirement?.questions ?? [],
  );
  const { questions: resolved, prefilledAnswers } = await resolveGradingQuestionsForSession({
    turns: session.transcript.map((t) => ({ speaker: t.speaker, message: t.message })),
    agendaQuestions,
    pickedOptionalIds: session.pickedOptionalQuestionIds,
  });
  let qs = await fillMissingIdealAnswersOnRecords(resolved, ctx, {
    transcriptTurns: session.transcript.map((t) => ({ speaker: t.speaker, message: t.message })),
    concurrency: 3,
  });

  const grading = await runQuestionGradingForSession({
    turns: session.transcript.map((t) => ({ speaker: t.speaker, message: t.message })),
    questions: qs,
    role: ctx.role,
    keySkills,
    prefilledAnswers,
  });
  if (!grading) throw new Error("grading returned null");

  const base = session.scorecard
    ? {
        overallScore: session.scorecard.overallScore,
        communication: session.scorecard.communication,
        domainDepth: session.scorecard.domainDepth,
        confidence: session.scorecard.confidence,
        summary: session.scorecard.summary,
        strengths: session.scorecard.strengths ?? [],
        improvements: session.scorecard.improvements ?? [],
        evidence: session.scorecard.evidence ?? [],
        scoringMode: session.scorecard.scoringMode ?? "heuristic-immediate",
        scoringModel: session.scorecard.scoringModel,
      }
    : buildScorecard({
        turns: session.transcript,
        domain: session.domain,
        topic: session.topic,
        positionTitle: session.positionTitle,
        keySkills,
        mandatoryQuestions: qs.filter((q) => q.isMandatory).map((q) => q.prompt),
      });

  const merged = mergeQuestionGradingIntoScorecard(base, grading);

  await prisma.scorecard.upsert({
    where: { sessionId },
    update: {
      overallScore: merged.overallScore,
      accuracyPercent: merged.accuracyPercent,
      questionResults: merged.questionResults,
      scoringMode: "question-grade-hybrid",
      scoringModel: getScoringModel(),
    },
    create: {
      sessionId,
      overallScore: merged.overallScore,
      communication: merged.communication,
      domainDepth: merged.domainDepth,
      confidence: merged.confidence,
      summary: merged.summary,
      strengths: merged.strengths,
      improvements: merged.improvements,
      evidence: merged.evidence,
      accuracyPercent: merged.accuracyPercent,
      questionResults: merged.questionResults,
      scoringMode: "question-grade-hybrid",
      scoringModel: getScoringModel(),
    },
  });

  for (const q of qs.filter((row) => row.expectedAnswer?.trim())) {
    await prisma.interviewQuestion.updateMany({
      where: { id: q.id, sessionId, expectedAnswer: null },
      data: { expectedAnswer: q.expectedAnswer, difficulty: q.difficulty },
    });
  }

  console.log("OK", {
    sessionId,
    accuracyPercent: merged.accuracyPercent,
    questions: merged.questionResults.length,
    idealPreview: merged.questionResults[0]?.expectedAnswer?.slice(0, 80),
  });
}

main()
  .catch((e) => {
    console.error("FAILED", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
