import dotenv from "dotenv";
import path from "path";
import { readdir, readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });
const prisma = new PrismaClient();

const localDir = path.join(__dirname, "..", "public", "interview-videos");
const localIds = (await readdir(localDir))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));

const sessions = await prisma.interviewSession.findMany({
  where: {
    status: "COMPLETED",
    id: { in: localIds.slice(0, 8) },
  },
  orderBy: { endedAt: "desc" },
  include: {
    transcript: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] },
    company: { select: { interviewerVoiceGender: true, name: true } },
  },
});

console.log(`Local pre-recorded videos: ${localIds.length}`);
console.log(`Completed sessions with transcript data: ${sessions.length}\n`);

for (const s of sessions) {
  const metaPath = path.join(localDir, `${s.id}.json`);
  let meta = null;
  try {
    meta = JSON.parse(await readFile(metaPath, "utf8"));
  } catch {
    /* no meta */
  }

  const emptyTurns = s.transcript.filter((t) => !(t.message || "").trim()).length;
  const candidateTurns = s.transcript.filter((t) => t.speaker === "CANDIDATE");
  const shortCandidate = candidateTurns.filter((t) => (t.message || "").trim().length < 8).length;
  const interviewerTurns = s.transcript.filter((t) => t.speaker === "INTERVIEWER");

  console.log("---", s.id);
  console.log("video:", `/interview-videos/${s.id}.webm`, meta ? `(${meta.durationSec}s)` : "");
  console.log("company:", s.company?.name, "| configured voice:", s.company?.interviewerVoiceGender);
  console.log(
    "transcript:",
    s.transcript.length,
    "turns | interviewer:",
    interviewerTurns.length,
    "| candidate:",
    candidateTurns.length,
    "| empty:",
    emptyTurns,
    "| very short candidate:",
    shortCandidate,
  );

  for (const t of s.transcript.slice(0, 6)) {
    console.log(`  [${t.speaker}] ${(t.message || "").replace(/\s+/g, " ").slice(0, 140)}`);
  }
  if (s.transcript.length > 6) console.log(`  ... +${s.transcript.length - 6} more turns`);

  const flags = [];
  if (s.transcript.length === 0) flags.push("NO_TRANSCRIPT");
  if (emptyTurns > 0) flags.push(`${emptyTurns}_EMPTY_TURNS`);
  if (shortCandidate > 2) flags.push("MANY_SHORT_CANDIDATE_ANSWERS");
  const duplicateAdjacent = s.transcript.some(
    (t, i) => i > 0 && t.message === s.transcript[i - 1].message,
  );
  if (duplicateAdjacent) flags.push("DUPLICATE_ADJACENT_TURNS");
  if (flags.length) console.log("  QA flags:", flags.join(", "));
  console.log();
}

await prisma.$disconnect();
