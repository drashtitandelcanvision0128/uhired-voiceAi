import assert from "node:assert/strict";
import {
  deriveInterviewerAvatarState,
  deriveInterviewStatusVisual,
  formatInterviewPauseStatus,
  getInterviewPauseOverlay,
} from "../src/lib/interview-room-display.ts";

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
}

console.log("Interview room display tests\n");

test("avatar shows thinking while interviewer is starting", () => {
  assert.equal(
    deriveInterviewerAvatarState({
      interviewerStarting: true,
      livePhase: "listening",
    }),
    "thinking",
  );
});

test("avatar speaks when AI audio is active", () => {
  assert.equal(
    deriveInterviewerAvatarState({
      interviewerStarting: false,
      livePhase: "speaking",
    }),
    "speaking",
  );
});

test("avatar listens when candidate is speaking", () => {
  assert.equal(
    deriveInterviewerAvatarState({
      interviewerStarting: false,
      livePhase: "you-speaking",
    }),
    "listening",
  );
});

test("avatar thinks while response is processing", () => {
  assert.equal(
    deriveInterviewerAvatarState({
      interviewerStarting: false,
      livePhase: "processing",
    }),
    "thinking",
  );
});

test("connecting stage shows loading spinner", () => {
  assert.deepEqual(
    deriveInterviewStatusVisual({
      stage: "connecting",
      visibilityBlocked: false,
      interviewerStarting: false,
      livePhase: "listening",
    }),
    { pulse: false, showSpinner: true, tone: "connecting" },
  );
});

test("interviewer starting shows loading spinner", () => {
  assert.deepEqual(
    deriveInterviewStatusVisual({
      stage: "live",
      visibilityBlocked: false,
      interviewerStarting: true,
      livePhase: "listening",
    }),
    { pulse: false, showSpinner: true, tone: "thinking" },
  );
});

test("AI speaking shows animated bars", () => {
  assert.deepEqual(
    deriveInterviewStatusVisual({
      stage: "live",
      visibilityBlocked: false,
      interviewerStarting: false,
      livePhase: "speaking",
    }),
    { pulse: true, showSpinner: false, tone: "speaking" },
  );
});

test("candidate speaking shows animated bars", () => {
  assert.deepEqual(
    deriveInterviewStatusVisual({
      stage: "live",
      visibilityBlocked: false,
      interviewerStarting: false,
      livePhase: "you-speaking",
    }),
    { pulse: true, showSpinner: false, tone: "you-speaking" },
  );
});

test("processing shows loading spinner", () => {
  assert.deepEqual(
    deriveInterviewStatusVisual({
      stage: "live",
      visibilityBlocked: false,
      interviewerStarting: false,
      livePhase: "processing",
    }),
    { pulse: false, showSpinner: true, tone: "processing" },
  );
});

test("ending stage shows loading spinner", () => {
  assert.deepEqual(
    deriveInterviewStatusVisual({
      stage: "ending",
      visibilityBlocked: false,
      interviewerStarting: false,
      livePhase: "listening",
    }),
    { pulse: false, showSpinner: true, tone: "processing" },
  );
});

test("pause status messages cover camera, mic, and face", () => {
  assert.match(formatInterviewPauseStatus("camera"), /camera/i);
  assert.match(formatInterviewPauseStatus("mic"), /microphone/i);
  assert.match(formatInterviewPauseStatus("face"), /visible/i);
});

test("pause overlay explains mic mute", () => {
  const overlay = getInterviewPauseOverlay("mic");
  assert.match(overlay.title, /paused/i);
  assert.match(overlay.body, /microphone is muted/i);
});

console.log("\nAll interview room display tests passed.\n");
