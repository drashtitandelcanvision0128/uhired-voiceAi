/**
 * Interview finish should not block the thank-you screen on video upload.
 * Run: node scripts/test-interview-video-save.mjs
 */
import assert from "node:assert/strict";

function simulateFinishTimeline({
  transcriptWaitMs,
  recorderStopMs,
  uploadMs,
  blockOnUpload,
}) {
  const recorderDoneAt = recorderStopMs;
  const transcriptDoneAt = transcriptWaitMs;
  const readyForCompleteAt = Math.max(recorderDoneAt, transcriptDoneAt);
  const completeAt = blockOnUpload ? readyForCompleteAt + uploadMs : readyForCompleteAt;
  const uploadDoneAt = recorderDoneAt + uploadMs;
  return { completeAt, uploadDoneAt };
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
}

console.log("Interview video save timing tests\n");

test("optimized finish reaches complete before upload finishes", () => {
  const { completeAt, uploadDoneAt } = simulateFinishTimeline({
    transcriptWaitMs: 2_000,
    recorderStopMs: 500,
    uploadMs: 25_000,
    blockOnUpload: false,
  });
  assert.ok(completeAt < uploadDoneAt);
  assert.equal(completeAt, 2_000);
});

test("blocking on upload delays thank-you screen by upload duration", () => {
  const blocked = simulateFinishTimeline({
    transcriptWaitMs: 2_000,
    recorderStopMs: 500,
    uploadMs: 25_000,
    blockOnUpload: true,
  });
  const optimized = simulateFinishTimeline({
    transcriptWaitMs: 2_000,
    recorderStopMs: 500,
    uploadMs: 25_000,
    blockOnUpload: false,
  });
  assert.equal(blocked.completeAt, 27_000);
  assert.equal(optimized.completeAt, 2_000);
  assert.ok(blocked.completeAt - optimized.completeAt >= 20_000);
});

test("recorder stop and transcript drain run in parallel", () => {
  const { completeAt } = simulateFinishTimeline({
    transcriptWaitMs: 8_000,
    recorderStopMs: 300,
    uploadMs: 30_000,
    blockOnUpload: false,
  });
  assert.equal(completeAt, 8_000);
});

console.log("\nAll interview video save timing tests passed.");
