import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1") });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const sessionId = process.argv[2] || "cmpcj3hbt0006v9b8k7cgd1mf";

async function main() {
  // Use dynamic import of TS sources via tsx if available
  const { fillMissingIdealAnswersOnRecords } = await import("../src/lib/generate-ideal-answers.ts");
  const { getQuestionsForGrading, resolveEffectiveQuestions } = await import(
    "../src/lib/interview-questions.ts"
  );
  const { runQuestionGradingForSession } = await import("../src/lib/question-grading.ts");
  const { resolveSessionKeySkills } = await import("../src/lib/session-key-skills.ts");

  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    include: {
      transcript: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] },
      questions: { orderBy: { orderIndex: "asc" } },
      requirement: { include: { questions: { orderBy: { orderIndex: "asc" } } } },
    },
  });
  if (!session) throw new Error("session not found");

  const keySkills = resolveSessionKeySkills(session, session.requirement);
  const ctx = {
    role: session.positionTitle || session.requirement?.title || session.domain,
    jobDescription: session.jobDescription || session.requirement?.jobDescription,
    keySkills,
    domain: session.domain,
    topic: session.topic,
  };

  let qs = getQuestionsForGrading(
    resolveEffectiveQuestions(session.questions, session.requirement?.questions ?? []),
    session.pickedOptionalQuestionIds,
  );
  console.log("questions before fill", qs.length, qs[0]?.prompt);

  qs = await fillMissingIdealAnswersOnRecords(qs, ctx);
  console.log("after fill ideal", qs[0]?.expectedAnswer?.slice(0, 120) ?? "NONE");

  const result = await runQuestionGradingForSession({
    turns: session.transcript.map((t) => ({ speaker: t.speaker, message: t.message })),
    questions: qs,
    role: ctx.role,
    keySkills,
  });
  console.log("grading result", result ? { accuracy: result.accuracyPercent, n: result.questionResults.length } : null);
}

main()
  .catch((e) => {
    console.error("FAILED", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
