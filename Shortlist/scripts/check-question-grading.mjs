import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const totalQuestions = await prisma.requirementQuestion.count();
const withIdeal = await prisma.requirementQuestion.count({
  where: { expectedAnswer: { not: null } },
});
const withIdealNonEmpty = await prisma.requirementQuestion.count({
  where: {
    AND: [{ expectedAnswer: { not: null } }, { NOT: { expectedAnswer: "" } }],
  },
});

const gradedScorecards = await prisma.scorecard.findMany({
  where: { accuracyPercent: { not: null } },
  take: 5,
  select: {
    sessionId: true,
    accuracyPercent: true,
    scoringMode: true,
    overallScore: true,
    questionResults: true,
  },
});

const recentCompleted = await prisma.interviewSession.findMany({
  where: { status: "COMPLETED" },
  orderBy: { endedAt: "desc" },
  take: 5,
  select: {
    id: true,
    endedAt: true,
    scorecard: {
      select: {
        scoringMode: true,
        accuracyPercent: true,
        overallScore: true,
      },
    },
  },
});

console.log(
  JSON.stringify(
    {
      dbMigrationOk: true,
      requirementQuestions: { total: totalQuestions, withIdealAnswerField: withIdeal, withNonEmptyIdeal: withIdealNonEmpty },
      gradedScorecardsCount: gradedScorecards.length,
      gradedScorecardSamples: gradedScorecards.map((s) => ({
        sessionId: s.sessionId,
        accuracyPercent: s.accuracyPercent,
        scoringMode: s.scoringMode,
        overallScore: s.overallScore,
        questionCount: Array.isArray(s.questionResults) ? s.questionResults.length : 0,
      })),
      recentCompletedInterviews: recentCompleted,
    },
    null,
    2,
  ),
);

const sessionQTotal = await prisma.interviewQuestion.count();
const sessionQIdeal = await prisma.interviewQuestion.count({
  where: { AND: [{ expectedAnswer: { not: null } }, { NOT: { expectedAnswer: "" } }] },
});

console.log(
  JSON.stringify(
    { sessionQuestions: { total: sessionQTotal, withNonEmptyIdeal: sessionQIdeal } },
    null,
    2,
  ),
);

await prisma.$disconnect();
