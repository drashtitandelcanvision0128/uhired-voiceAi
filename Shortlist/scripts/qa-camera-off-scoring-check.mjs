/**
 * QA: "camera off + no response" scoring scenario.
 * Simulates interviewer-only transcript (candidate never spoke) and verifies
 * the blended overall score is not artificially inflated (previously ~19/100).
 *
 * Run: node scripts/qa-camera-off-scoring-check.mjs
 */
import assert from "node:assert/strict";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import { buildHeuristicScorecard } from "../src/lib/scoring.ts";
import {
  mergeQuestionGradingIntoScorecard,
  runQuestionGradingForSession,
} from "../src/lib/question-grading.ts";
import { holisticOverallFromDimensions } from "../src/lib/scorecard-scoring-formula.ts";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
}

/** Typical transcript when AI runs but candidate stays silent (camera off / muted). */
const NO_RESPONSE_TURNS = [
  { speaker: "INTERVIEWER", message: "Hello! I'm your AI interviewer today. Could you introduce yourself?" },
  { speaker: "INTERVIEWER", message: "I didn't catch a response — are you still there?" },
  { speaker: "INTERVIEWER", message: "Let's move on. Can you tell me about your experience with this role?" },
  { speaker: "INTERVIEWER", message: "Thank you for your time. We'll wrap up here." },
];

const SAMPLE_QUESTIONS = [
  {
    id: "q1",
    prompt: "Tell me about yourself and your relevant experience.",
    isMandatory: true,
    difficulty: "medium",
    expectedAnswer: "A concise professional introduction with role-relevant highlights.",
  },
  {
    id: "q2",
    prompt: "Describe a challenging project you led and the outcome.",
    isMandatory: true,
    difficulty: "medium",
    expectedAnswer: "STAR-format story with scope, actions, and measurable results.",
  },
  {
    id: "q3",
    prompt: "How do you prioritize when multiple stakeholders have conflicting needs?",
    isMandatory: false,
    difficulty: "medium",
    expectedAnswer: "Framework for stakeholder alignment, trade-offs, and communication.",
  },
];

console.log("Camera off + no response — scoring verification\n");

// --- Unit simulation (no OpenAI) ---
const heuristic = buildHeuristicScorecard(NO_RESPONSE_TURNS);
const holistic = holisticOverallFromDimensions(
  heuristic.communication,
  heuristic.domainDepth,
  heuristic.confidence,
);

test("heuristic baseline with zero candidate turns is moderate (not used alone)", () => {
  assert.equal(heuristic.overallScore, 44, "expected heuristic ~44 with 0 candidate words");
});

const grading = await runQuestionGradingForSession({
  turns: NO_RESPONSE_TURNS,
  questions: SAMPLE_QUESTIONS,
  role: "Software Engineer",
  keySkills: ["TypeScript", "System Design"],
  prefilledAnswers: new Map(SAMPLE_QUESTIONS.map((q) => [q.id, ""])),
});

test("all questions graded as Not Answered with 0% accuracy", () => {
  assert.ok(grading);
  assert.equal(grading.accuracyPercent, 0);
  assert.ok(grading.questionResults.every((r) => r.result === "Not Answered"));
  assert.ok(grading.questionResults.every((r) => r.overallScore === 0));
});

const merged = mergeQuestionGradingIntoScorecard(heuristic, grading);
const oldBlend = Math.round(grading.accuracyPercent * 0.6 + holistic * 0.4);

console.log("\n  Simulated scores:");
console.log(`    Holistic (heuristic):     ${holistic}/100`);
console.log(`    Answer accuracy:          ${grading.accuracyPercent}%`);
console.log(`    Old blend (60/40):        ${oldBlend}/100  ← previously inflated`);
console.log(`    Current blend (80/20):    ${merged.overallScore}/100`);

test("current overall is well below the old inflated ~19", () => {
  assert.ok(merged.overallScore < 15, `expected <15, got ${merged.overallScore}`);
  assert.ok(oldBlend >= 17 && oldBlend <= 20, `old blend should be ~19, got ${oldBlend}`);
});

test("current overall reflects zero participation (≤10)", () => {
  assert.ok(merged.overallScore <= 10, `expected ≤10 for no response, got ${merged.overallScore}`);
});

// --- DB spot-check: sessions with 0% accuracy ---
const prisma = new PrismaClient();
try {
  const zeroAcc = await prisma.scorecard.findMany({
    where: { accuracyPercent: 0 },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      sessionId: true,
      overallScore: true,
      accuracyPercent: true,
      communication: true,
      domainDepth: true,
      confidence: true,
      scoringMode: true,
    },
  });

  console.log("\n  DB sessions with 0% answer accuracy:");
  for (const row of zeroAcc) {
    const h = holisticOverallFromDimensions(row.communication, row.domainDepth, row.confidence);
    const expected = Math.round(row.accuracyPercent * 0.8 + h * 0.2);
    console.log(
      `    ${row.sessionId}  overall=${row.overallScore}  expected=${expected}  holistic=${h}  mode=${row.scoringMode}`,
    );
    assert.ok(
      row.overallScore <= 15,
      `session ${row.sessionId} overall ${row.overallScore} still inflated`,
    );
  }

  if (zeroAcc.length === 0) {
    console.log("    (none found — simulation-only check passed)");
  } else {
    test("DB zero-accuracy sessions are not inflated above 15", () => {
      assert.ok(zeroAcc.every((r) => r.overallScore <= 15));
    });
  }
} finally {
  await prisma.$disconnect();
}

console.log("\nAll camera-off / no-response scoring checks passed.\n");
