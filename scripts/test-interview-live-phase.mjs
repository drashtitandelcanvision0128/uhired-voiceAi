import assert from "node:assert/strict";
import {
  deriveInterviewLivePhase,
  formatLivePhaseStatus,
} from "../src/lib/interview-live-phase.ts";

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
}

console.log("Interview live phase tests\n");

test("AI speaking takes priority", () => {
  assert.equal(
    deriveInterviewLivePhase({
      aiAudioActive: true,
      responseInFlight: true,
      candidateSpeechActive: true,
      unsettledCandidateUtterances: 1,
      responseDelayPending: true,
    }),
    "speaking",
  );
});

test("thinking while response is in flight", () => {
  assert.equal(
    deriveInterviewLivePhase({
      aiAudioActive: false,
      responseInFlight: true,
      candidateSpeechActive: false,
      unsettledCandidateUtterances: 0,
      responseDelayPending: false,
    }),
    "thinking",
  );
});

test("candidate speaking is shown before processing", () => {
  assert.equal(
    deriveInterviewLivePhase({
      aiAudioActive: false,
      responseInFlight: false,
      candidateSpeechActive: true,
      unsettledCandidateUtterances: 1,
      responseDelayPending: false,
    }),
    "you-speaking",
  );
});

test("unsettled transcription shows processing", () => {
  assert.equal(
    deriveInterviewLivePhase({
      aiAudioActive: false,
      responseInFlight: false,
      candidateSpeechActive: false,
      unsettledCandidateUtterances: 1,
      responseDelayPending: false,
    }),
    "processing",
  );
});

test("response delay timer shows processing", () => {
  assert.equal(
    deriveInterviewLivePhase({
      aiAudioActive: false,
      responseInFlight: false,
      candidateSpeechActive: false,
      unsettledCandidateUtterances: 0,
      responseDelayPending: true,
    }),
    "processing",
  );
});

test("idle state listens for candidate", () => {
  assert.equal(
    deriveInterviewLivePhase({
      aiAudioActive: false,
      responseInFlight: false,
      candidateSpeechActive: false,
      unsettledCandidateUtterances: 0,
      responseDelayPending: false,
    }),
    "listening",
  );
});

test("status copy covers processing and speaking states", () => {
  assert.equal(formatLivePhaseStatus("processing", "Alex"), "Processing your response…");
  assert.equal(formatLivePhaseStatus("you-speaking", "Alex"), "You're speaking…");
  assert.equal(formatLivePhaseStatus("thinking", "Alex"), "Alex is thinking…");
});

console.log("\nAll interview live phase tests passed.\n");
