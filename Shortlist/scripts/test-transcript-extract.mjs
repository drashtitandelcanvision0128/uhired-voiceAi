import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });
const prisma = new PrismaClient();
const sessionId = process.argv[2] || "cmpcj3hbt0006v9b8k7cgd1mf";

const session = await prisma.interviewSession.findUnique({
  where: { id: sessionId },
  include: { transcript: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] } },
});
if (!session) throw new Error("not found");

const { extractQAPairsFromTranscript, heuristicExtractQAPairs } = await import(
  "../src/lib/extract-transcript-qa.ts"
);
const turns = session.transcript.map((t) => ({ speaker: t.speaker, message: t.message }));
console.log("turns", turns.length);
const h = heuristicExtractQAPairs(turns);
console.log("heuristic pairs", h.length);
h.forEach((p, i) => console.log(i + 1, p.question.slice(0, 90), "| ans:", p.candidateAnswer.slice(0, 60)));

const full = await extractQAPairsFromTranscript(turns);
console.log("\nAI pairs", full.length);
full.forEach((p, i) => console.log(i + 1, p.question.slice(0, 90)));

await prisma.$disconnect();
