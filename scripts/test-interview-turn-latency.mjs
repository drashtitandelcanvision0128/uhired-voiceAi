/**
 * Tests for interview turn latency helpers and prompt caching.
 * Run: npx tsx scripts/test-interview-turn-latency.mjs
 */
import assert from "node:assert/strict";
import { InterviewTurnPerformanceTracker, TURN_LATENCY_TARGET_MS } from "../src/lib/interview-turn-performance.ts";
import { clearPromptCache } from "../src/lib/interview-prompt-cache.ts";
import {
  buildNextQuestionResponseInstructions,
  INTERVIEW_TURN_TIMING,
} from "../src/lib/interview-prompt.ts";
import { InterviewConversationManager } from "../src/lib/interview-conversation-state.ts";

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
}

console.log("Interview turn latency tests\n");

test("turn timing constants target sub-second scheduling", () => {
  assert.ok(INTERVIEW_TURN_TIMING.candidateResponseDelayMs < 200);
  assert.ok(INTERVIEW_TURN_TIMING.transcriptTurnWaitMs < 1500);
  assert.equal(INTERVIEW_TURN_TIMING.transcriptTurnWaitSubstantiveMs, 0);
});

test("performance tracker records milestones and summary", () => {
  const tracker = new InterviewTurnPerformanceTracker();
  const gen = 7;
  const base = Date.now();
  tracker.startTurn(gen);
  tracker.mark(gen, "speech_stopped");
  const record = tracker.finishTurn(gen);
  assert.ok(record);
  const summary = tracker.getSummary(gen);
  assert.equal(summary.withinTarget, null);
  assert.equal(TURN_LATENCY_TARGET_MS, 1000);
  void base;
});

test("prompt cache returns stable strings for identical inputs", () => {
  clearPromptCache();
  const input = { sessionType: "COMPANY", keySkills: ["React"], nextQuestionText: "Describe state management." };
  const first = buildNextQuestionResponseInstructions(input);
  const second = buildNextQuestionResponseInstructions(input);
  assert.equal(first, second);
  assert.match(first, /Describe state management/);
});

test("conversation manager preloads next predefined question hint", () => {
  const manager = new InterviewConversationManager({
    sessionType: "COMPANY",
    keySkills: [],
    predefinedQuestions: ["How do you handle incidents?", "Describe your testing approach."],
    logTransitions: false,
  });
  manager.onOpeningComplete("Please introduce yourself.");
  manager.onTranscriptReceived("I am a platform engineer with ten years of experience.");
  manager.onInterviewerResponseScheduled();
  manager.onInterviewerUtterance("How do you handle incidents?");
  manager.onTranscriptReceived("We use runbooks and on-call rotations.");
  const instructions = manager.preloadResponseInstructions("We use runbooks and on-call rotations.");
  assert.ok(instructions);
  assert.match(instructions, /Describe your testing approach/);
});

console.log("\nAll interview turn latency tests passed.");
