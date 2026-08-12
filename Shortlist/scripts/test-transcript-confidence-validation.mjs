/**
 * Tests for transcript confidence validation and retry gating.
 * Run: node scripts/test-transcript-confidence-validation.mjs
 */
import assert from "node:assert/strict";
import {
  DEFAULT_TRANSCRIPTION_CONFIDENCE_MAX_RETRIES,
  DEFAULT_TRANSCRIPTION_CONFIDENCE_THRESHOLD,
  resolveTranscriptConfidenceConfig,
  validateTranscriptConfidence,
} from "../src/lib/transcript-confidence-validation.ts";
import {
  InterviewConversationManager,
} from "../src/lib/interview-conversation-state.ts";
import {
  buildLowConfidenceRepeatResponseInstructions,
  buildSilenceCheckInResponseInstructions,
} from "../src/lib/interview-prompt.ts";

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
}

const config = {
  threshold: DEFAULT_TRANSCRIPTION_CONFIDENCE_THRESHOLD,
  maxRetries: DEFAULT_TRANSCRIPTION_CONFIDENCE_MAX_RETRIES,
};

console.log("Transcript confidence validation tests\n");

test("resolveTranscriptConfidenceConfig uses production defaults", () => {
  const resolved = resolveTranscriptConfidenceConfig({});
  assert.equal(resolved.threshold, 0.5);
  assert.equal(resolved.maxRetries, 3);
});

test("accepts high-confidence substantive transcripts", () => {
  const result = validateTranscriptConfidence({
    text: "I led the migration to microservices last year.",
    confidence: 0.92,
    rejectedAsNoise: false,
    retryCount: 0,
    config,
  });
  assert.equal(result.accepted, true);
  assert.equal(result.reason, "above_threshold");
});

test("rejects low-confidence substantive transcripts without treating as answered", () => {
  const result = validateTranscriptConfidence({
    text: "I led the migration to microservices last year.",
    confidence: 0.31,
    rejectedAsNoise: false,
    retryCount: 0,
    config,
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "below_threshold");
  assert.equal(result.shouldRetry, true);
});

test("allows multiple retries until max is reached", () => {
  const first = validateTranscriptConfidence({
    text: "We used Kubernetes for orchestration.",
    confidence: 0.2,
    rejectedAsNoise: false,
    retryCount: 0,
    config,
  });
  assert.equal(first.shouldRetry, true);

  const last = validateTranscriptConfidence({
    text: "We used Kubernetes for orchestration.",
    confidence: 0.2,
    rejectedAsNoise: false,
    retryCount: config.maxRetries,
    config,
  });
  assert.equal(last.shouldRetry, false);
});

test("accepts transcripts when confidence data is unavailable", () => {
  const result = validateTranscriptConfidence({
    text: "I have eight years of backend experience.",
    confidence: null,
    rejectedAsNoise: false,
    retryCount: 0,
    config,
  });
  assert.equal(result.accepted, true);
  assert.equal(result.reason, "no_confidence_data");
});

test("routes noise and empty transcripts to the silence path", () => {
  const noise = validateTranscriptConfidence({
    text: "",
    confidence: 0.1,
    rejectedAsNoise: true,
    retryCount: 0,
    config,
  });
  assert.equal(noise.accepted, false);
  assert.equal(noise.reason, "empty_or_noise");
  assert.equal(noise.shouldRetry, false);
});

test("FSM marks low-confidence turns without advancing", () => {
  const manager = new InterviewConversationManager({
    sessionType: "COMPANY",
    keySkills: ["React"],
    predefinedQuestions: ["How do you handle production incidents?"],
    logTransitions: false,
  });
  manager.onOpeningComplete("Please introduce yourself.");
  manager.onCandidateSpeechStarted();
  manager.onCandidateSpeechStopped();
  manager.onTranscriptLowConfidence();
  assert.equal(manager.snapshot.currentEvaluationStatus, "low_confidence");
  assert.equal(manager.canAdvanceToNextQuestion(), false);
  assert.equal(manager.snapshot.transcriptRetryCount, 1);
  assert.equal(
    manager.getResponseInstructions(),
    buildLowConfidenceRepeatResponseInstructions(1),
  );
});

test("FSM resets retry count after a successful substantive answer", () => {
  const manager = new InterviewConversationManager({
    sessionType: "COMPANY",
    keySkills: ["React"],
    predefinedQuestions: ["How do you handle production incidents?"],
    logTransitions: false,
  });
  manager.onOpeningComplete("Please introduce yourself.");
  manager.onTranscriptLowConfidence();
  manager.onTranscriptLowConfidence();
  assert.equal(manager.snapshot.transcriptRetryCount, 2);
  manager.onTranscriptReceived("I am a senior engineer with deep React experience.");
  assert.equal(manager.snapshot.currentEvaluationStatus, "substantive");
  assert.equal(manager.snapshot.transcriptRetryCount, 0);
});

test("low-confidence instructions differ from silence check-in", () => {
  const lowConfidence = buildLowConfidenceRepeatResponseInstructions(0);
  const silence = buildSilenceCheckInResponseInstructions();
  assert.match(lowConfidence, /repeat your answer/i);
  assert.match(silence, /silent/i);
  assert.notEqual(lowConfidence, silence);
});

console.log("\nAll transcript confidence validation tests passed.");
