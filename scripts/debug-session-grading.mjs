import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const sessionId = process.argv[2] || "cmpcj3hbt0006v9b8k7cgd1mf";

const session = await prisma.interviewSession.findUnique({
  where: { id: sessionId },
  include: {
    transcript: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] },
    questions: { orderBy: { orderIndex: "asc" } },
    requirement: { include: { questions: { orderBy: { orderIndex: "asc" } } } },
    scorecard: true,
  },
});

console.log(
  JSON.stringify(
    {
      id: session?.id,
      status: session?.status,
      sessionQuestions: session?.questions?.length ?? 0,
      requirementQuestions: session?.requirement?.questions?.length ?? 0,
      transcriptTurns: session?.transcript?.length ?? 0,
      pickedOptional: session?.pickedOptionalQuestionIds,
      scorecard: session?.scorecard
        ? {
            scoringMode: session.scorecard.scoringMode,
            accuracyPercent: session.scorecard.accuracyPercent,
            hasQuestionResults: Boolean(session.scorecard.questionResults),
          }
        : null,
      sampleQuestions: session?.questions?.slice(0, 3).map((q) => ({
        prompt: q.prompt.slice(0, 80),
        expectedAnswer: q.expectedAnswer?.slice(0, 40) ?? null,
      })),
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
