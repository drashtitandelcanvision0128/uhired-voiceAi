/**
 * Offline verification for semantic evaluation helpers (no API key required).
 * Run: node scripts/verify-semantic-evaluation.mjs
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Use tsx-free approach: duplicate minimal pure logic tests inline
// since the project has no test runner configured.

function preprocessSpokenAnswer(raw) {
  const FILLER_WORDS = new Set(["um", "uh", "like", "basically", "you know", "i mean", "kind of"]);
  const original = raw.trim();
  let cleaned = original.toLowerCase();
  let removed = 0;

  for (const phrase of ["you know", "i mean", "kind of"]) {
    const pattern = new RegExp(`\\b${phrase.replace(/\s+/g, "\\s+")}\\b`, "gi");
    const matches = cleaned.match(pattern);
    if (matches) removed += matches.length;
    cleaned = cleaned.replace(pattern, " ");
  }

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const kept = [];
  for (const token of tokens) {
    const normalized = token.replace(/[^a-z0-9'-]/g, "");
    if (FILLER_WORDS.has(normalized)) {
      removed += 1;
      continue;
    }
    kept.push(token);
  }

  return { original, cleaned: kept.join(" "), removedFillerCount: removed };
}

function cosineSimilarity(vectorA, vectorB) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vectorA.length; i += 1) {
    dot += vectorA[i] * vectorB[i];
    normA += vectorA[i] * vectorA[i];
    normB += vectorB[i] * vectorB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const tests = [];

function assert(name, condition) {
  tests.push({ name, pass: Boolean(condition) });
}

// Preprocessing
const preprocessed = preprocessSpokenAnswer(
  "Um, so like, you know, React uses a virtual DOM, basically, for efficient updates.",
);
assert("removes filler words", preprocessed.removedFillerCount >= 4);
assert("preserves technical content", preprocessed.cleaned.includes("virtual dom"));

// Cosine similarity
assert(
  "identical vectors score 1",
  Math.abs(cosineSimilarity([1, 0, 0], [1, 0, 0]) - 1) < 0.001,
);
assert(
  "orthogonal vectors score 0",
  Math.abs(cosineSimilarity([1, 0, 0], [0, 1, 0])) < 0.001,
);
assert(
  "similar vectors score high",
  cosineSimilarity([0.9, 0.1, 0], [0.85, 0.15, 0.05]) > 0.95,
);

const failed = tests.filter((t) => !t.pass);
for (const test of tests) {
  console.log(`${test.pass ? "PASS" : "FAIL"}: ${test.name}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} test(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${tests.length} semantic evaluation checks passed.`);
