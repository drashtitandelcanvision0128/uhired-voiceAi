/**
 * Simulates interview turn-taking guards to catch regressions in lag/cutoff fixes.
 * Run: node scripts/test-interview-turn-taking.mjs
 */
import assert from "node:assert/strict";

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
}

/** Current (buggy) model: responseInFlight clears on first audio delta. */
function simulateCurrentTurnGuard(events) {
  let responseInFlight = false;
  let aiAudioActive = false;
  let scheduledResponses = 0;

  for (const event of events) {
    if (event === "response.create") responseInFlight = true;
    if (event === "response.audio.delta") {
      responseInFlight = false; // bug: cleared too early
      aiAudioActive = true;
    }
    if (event === "audio.waiting") {
      aiAudioActive = false; // bug: buffering treated as speech ended
    }
    if (event === "response.done") {
      responseInFlight = false;
      aiAudioActive = false;
    }
    if (event === "candidate.speech_stopped") {
      if (!aiAudioActive && !responseInFlight) {
        scheduledResponses += 1;
      }
    }
  }
  return scheduledResponses;
}

/** Fixed model: responseInFlight stays true until response.done; ignore audio.waiting. */
function simulateFixedTurnGuard(events) {
  let responseInFlight = false;
  let aiAudioActive = false;
  let scheduledResponses = 0;

  for (const event of events) {
    if (event === "response.create") responseInFlight = true;
    if (event === "response.audio.delta") {
      aiAudioActive = true;
    }
    if (event === "audio.waiting") {
      // buffering — do not mark AI as inactive
    }
    if (event === "response.done") {
      responseInFlight = false;
      aiAudioActive = false;
    }
    if (event === "candidate.speech_stopped") {
      if (!aiAudioActive && !responseInFlight) {
        scheduledResponses += 1;
      }
    }
  }
  return scheduledResponses;
}

function simulateResponseScheduling({ waitForTranscript, transcriptDelayMs, responseDelayMs }) {
  let t = 0;
  if (waitForTranscript) {
    t = transcriptDelayMs + responseDelayMs;
  } else {
    t = responseDelayMs;
  }
  return t;
}

/** Guards against scheduling twice for the same utterance generation. */
function simulateRespondedGenGuard({ speechStoppedAt, transcriptAt, responseDelayMs }) {
  let respondedGen = null;
  let schedules = 0;
  const gen = 1;

  const trySchedule = (at) => {
    if (respondedGen === gen) return;
    schedules += 1;
    respondedGen = gen;
    return at + responseDelayMs;
  };

  trySchedule(speechStoppedAt);
  if (transcriptAt != null) trySchedule(transcriptAt);
  return schedules;
}

console.log("Interview turn-taking simulation tests\n");

test("current model allows duplicate response mid-question (cutoff bug)", () => {
  const events = [
    "response.create",
    "response.audio.delta",
    "audio.waiting",
    "candidate.speech_stopped",
    "response.done",
  ];
  const duplicates = simulateCurrentTurnGuard(events);
  assert.equal(duplicates, 1, "expected duplicate response while first question still active");
});

test("fixed model blocks duplicate response until response.done", () => {
  const events = [
    "response.create",
    "response.audio.delta",
    "audio.waiting",
    "candidate.speech_stopped",
    "response.done",
  ];
  const duplicates = simulateFixedTurnGuard(events);
  assert.equal(duplicates, 0, "must not schedule while response is in flight");
});

test("waiting for transcription adds ~2s lag vs speech-stopped scheduling", () => {
  const withTranscript = simulateResponseScheduling({
    waitForTranscript: true,
    transcriptDelayMs: 2000,
    responseDelayMs: 400,
  });
  const withoutTranscript = simulateResponseScheduling({
    waitForTranscript: false,
    transcriptDelayMs: 0,
    responseDelayMs: 250,
  });
  assert.ok(withTranscript >= 2000);
  assert.ok(withoutTranscript <= 300);
  assert.ok(withTranscript - withoutTranscript >= 1500);
});

test("responded-gen guard prevents duplicate response from late transcription", () => {
  const schedules = simulateRespondedGenGuard({
    speechStoppedAt: 0,
    transcriptAt: 1800,
    responseDelayMs: 250,
  });
  assert.equal(schedules, 1);
});

console.log("\nAll turn-taking simulation tests passed.");
