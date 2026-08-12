/**
 * Tests for speech-to-text post-processing and confidence scoring.
 * Run: node scripts/test-speech-transcription.mjs
 */
import assert from "node:assert/strict";
import {
  buildTechnicalTermCorrections,
  buildTranscriptionPrompt,
  confidenceFromLogprobs,
  correctTechnicalTerms,
  extractTechnicalTermsFromTexts,
  isLikelyNoiseTranscript,
  normalizeTranscriptPunctuation,
  processCandidateTranscript,
} from "../src/lib/speech-transcription.ts";

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
}

console.log("Speech transcription tests\n");

test("buildTranscriptionPrompt includes domain vocabulary", () => {
  const prompt = buildTranscriptionPrompt({
    domain: "Engineering",
    topic: "Backend",
    positionTitle: "Senior Node.js Developer",
    keySkills: ["Node.js", "PostgreSQL", "Redis"],
    jobDescription: "Build scalable APIs with microservices architecture.",
  });
  assert.match(prompt, /Node\.js/);
  assert.match(prompt, /PostgreSQL/);
  assert.match(prompt, /English accents/i);
  assert.match(prompt, /keyboard typing/i);
});

test("confidenceFromLogprobs returns average token probability", () => {
  const high = confidenceFromLogprobs([{ logprob: -0.1 }, { logprob: -0.2 }]);
  assert.ok(high !== null && high > 0.8);

  const low = confidenceFromLogprobs([{ logprob: -3 }, { logprob: -4 }]);
  assert.ok(low !== null && low < 0.1);

  assert.equal(confidenceFromLogprobs(undefined), null);
  assert.equal(confidenceFromLogprobs([]), null);
});

test("isLikelyNoiseTranscript rejects keyboard and mic noise", () => {
  assert.equal(isLikelyNoiseTranscript("click click", 0.9), true);
  assert.equal(isLikelyNoiseTranscript("typing", 0.9), true);
  assert.equal(isLikelyNoiseTranscript("aaaa", 0.9), true);
  assert.equal(isLikelyNoiseTranscript("uh", 0.9), true);
  assert.equal(isLikelyNoiseTranscript("Yes", 0.9), false);
  assert.equal(isLikelyNoiseTranscript("I led the migration", 0.85), false);
  assert.equal(isLikelyNoiseTranscript("ok", 0.2), true);
});

test("isLikelyNoiseTranscript rejects ASR hallucinations on silence", () => {
  assert.equal(isLikelyNoiseTranscript("Bye-bye.", 0.95), true);
  assert.equal(isLikelyNoiseTranscript("Hooray! Hooray! Hooray! Hooray!", 0.92), true);
  assert.equal(isLikelyNoiseTranscript("Thank you for watching.", 0.88), true);
  assert.equal(isLikelyNoiseTranscript("Yes.", 0.9), false);
  assert.equal(isLikelyNoiseTranscript("No", 0.85), false);
});

test("normalizeTranscriptPunctuation capitalizes and adds terminal period", () => {
  assert.equal(
    normalizeTranscriptPunctuation("i worked on distributed systems for three years"),
    "I worked on distributed systems for three years.",
  );
  assert.equal(normalizeTranscriptPunctuation("Yes."), "Yes.");
  assert.equal(normalizeTranscriptPunctuation("OK"), "OK");
});

test("processCandidateTranscript filters noise and preserves substantive answers", () => {
  const noise = processCandidateTranscript("click", [{ logprob: -0.5 }]);
  assert.equal(noise.rejectedAsNoise, true);
  assert.equal(noise.text, "");

  const hallucination = processCandidateTranscript("Bye-bye.", [{ logprob: -0.05 }]);
  assert.equal(hallucination.rejectedAsNoise, true);
  assert.equal(hallucination.text, "");

  const answer = processCandidateTranscript(
    "we used kubernetes for container orchestration",
    [{ logprob: -0.05 }, { logprob: -0.08 }],
  );
  assert.equal(answer.rejectedAsNoise, false);
  assert.match(answer.text, /^We used kubernetes/);
  assert.ok(answer.confidence !== null && answer.confidence > 0.9);
});

test("processCandidateTranscript never returns partial-looking fragments as final", () => {
  const result = processCandidateTranscript(
    "  we migrated the monolith to microservices last year  ",
    [{ logprob: -0.1 }],
  );
  assert.equal(result.text, "We migrated the monolith to microservices last year.");
  assert.equal(result.rejectedAsNoise, false);
});

test("correctTechnicalTerms fixes BUG-002 mistranscriptions", () => {
  assert.equal(
    correctTechnicalTerms("that server LL404, as well as many server errors"),
    "that server 404, as well as many server errors",
  );
  assert.equal(
    correctTechnicalTerms("I have used NA10, I have also used workspaces"),
    "I have used N8N, I have also used workspaces",
  );
  assert.equal(
    correctTechnicalTerms("error LL404 when connecting to the API"),
    "404 when connecting to the API",
  );
});

test("processCandidateTranscript applies technical term corrections", () => {
  const ctx = {
    domain: "Engineering",
    keySkills: ["Node.js", "N8N", "automation"],
    interviewQuestions: ["Describe a challenging server error you handled."],
  };
  const result = processCandidateTranscript(
    "problems that I have faced like connecting it to the server, that server LL404",
    [{ logprob: -0.05 }],
    { transcriptionContext: ctx },
  );
  assert.match(result.text, /404/);
  assert.doesNotMatch(result.text, /LL404/i);

  const automation = processCandidateTranscript(
    "I have used NA10 for WhatsApp automations",
    [{ logprob: -0.05 }],
    { transcriptionContext: ctx },
  );
  assert.match(automation.text, /N8N/);
  assert.doesNotMatch(automation.text, /NA10/i);
});

test("extractTechnicalTermsFromTexts finds acronyms and mixed tokens", () => {
  const terms = extractTechnicalTermsFromTexts([
    "Experience with N8N, Node.js, and HTTP 404 errors",
    "CI/CD pipelines using Kubernetes",
  ]);
  assert.ok(terms.includes("N8N"));
  assert.ok(terms.includes("Node.js"));
  assert.ok(terms.includes("HTTP"));
  assert.ok(terms.includes("CI/CD"));
});

test("buildTranscriptionPrompt includes phonetic hints for technical interviews", () => {
  const prompt = buildTranscriptionPrompt({
    domain: "Software Engineering",
    positionTitle: "Backend Developer",
    keySkills: ["N8N", "Node.js", "automation"],
    interviewQuestions: ["Tell me about server errors you have handled."],
  });
  assert.match(prompt, /N8N/);
  assert.match(prompt, /404/);
  assert.match(prompt, /Spell these technical terms exactly/i);
});

test("buildTechnicalTermCorrections includes global and session patterns", () => {
  const corrections = buildTechnicalTermCorrections({ keySkills: ["N8N", "Node.js"] });
  assert.ok(corrections.length >= 2);
  assert.equal(correctTechnicalTerms("server LL404", corrections), "server 404");
  assert.equal(correctTechnicalTerms("I used NA10", corrections), "I used N8N");
});

console.log("\nAll speech transcription tests passed.");
