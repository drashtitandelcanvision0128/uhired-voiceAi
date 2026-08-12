/**
 * Recompute Scorecard.overallScore for sessions that already have answer grading,
 * using the new blend: 80% accuracyPercent + 20% holistic.
 *
 * Holistic is re-derived from stored dimensions:
 *   holistic = round(communication*0.35 + domainDepth*0.4 + confidence*0.25)
 *
 * No OpenAI calls. No regrading. Pure DB-side recompute.
 *
 * Usage:
 *   Dry run (default, prints diffs, no writes):
 *     node scripts/recompute-overall-scores.mjs
 *   Apply updates:
 *     node scripts/recompute-overall-scores.mjs --apply
 *   Limit to one session:
 *     node scripts/recompute-overall-scores.mjs --session <sessionId> [--apply]
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const sessionIdx = args.indexOf("--session");
const onlySessionId = sessionIdx >= 0 ? args[sessionIdx + 1] : null;

function holisticFromDimensions(communication, domainDepth, confidence) {
  return Math.round(communication * 0.35 + domainDepth * 0.4 + confidence * 0.25);
}

async function main() {
  const where = { accuracyPercent: { not: null } };
  if (onlySessionId) where.sessionId = onlySessionId;

  const rows = await prisma.scorecard.findMany({
    where,
    select: {
      id: true,
      sessionId: true,
      overallScore: true,
      communication: true,
      domainDepth: true,
      confidence: true,
      accuracyPercent: true,
      scoringMode: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  console.log(
    `Found ${rows.length} scorecard(s) with answer grading${onlySessionId ? ` for session ${onlySessionId}` : ""}.`,
  );
  console.log(`Mode: ${apply ? "APPLY (will write)" : "DRY RUN (no writes)"}\n`);

  let changed = 0;
  let unchanged = 0;
  const updates = [];

  for (const r of rows) {
    const holistic = holisticFromDimensions(r.communication, r.domainDepth, r.confidence);
    const newOverall = Math.round(r.accuracyPercent * 0.8 + holistic * 0.2);
    const delta = newOverall - r.overallScore;

    if (delta === 0) {
      unchanged++;
      continue;
    }
    changed++;
    updates.push({ id: r.id, sessionId: r.sessionId, oldOverall: r.overallScore, newOverall, delta });

    console.log(
      `  ${r.sessionId}  old=${r.overallScore}  new=${newOverall}  ` +
        `(acc=${r.accuracyPercent}, holistic=${holistic}, Δ=${delta > 0 ? "+" : ""}${delta})`,
    );
  }

  console.log(`\nSummary: ${changed} would change, ${unchanged} already match.`);

  if (apply && changed > 0) {
    console.log(`\nApplying ${changed} update(s)...`);
    await prisma.$transaction(
      updates.map((u) =>
        prisma.scorecard.update({
          where: { id: u.id },
          data: { overallScore: u.newOverall },
        }),
      ),
    );
    console.log("Done.");
  } else if (!apply && changed > 0) {
    console.log("\nRe-run with --apply to write these changes.");
  }
}

main()
  .catch((e) => {
    console.error("FAILED", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
