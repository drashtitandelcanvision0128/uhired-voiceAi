/**
 * Interview duration display prefers recording/interview elapsed over wall clock.
 * Run: node scripts/test-interview-duration.mjs
 */
import assert from "node:assert/strict";

function computeMandatoryQuestionCount(durationMin) {
  const INTERVIEW_OVERHEAD_MIN = 3;
  const INTERVIEW_MINUTES_PER_QUESTION = 3;
  const MAX_MANDATORY_QUESTIONS = 5;
  const minutes = Math.max(5, Math.floor(durationMin));
  const available = minutes - INTERVIEW_OVERHEAD_MIN;
  if (available <= 0) return 1;
  return Math.min(
    MAX_MANDATORY_QUESTIONS,
    Math.max(1, Math.floor(available / INTERVIEW_MINUTES_PER_QUESTION)),
  );
}

function toMs(value) {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function formatInterviewDuration(input) {
  if (input.videoDurationSec != null && input.videoDurationSec > 0) {
    const totalSec = Math.round(input.videoDurationSec);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min < 1) return `${totalSec} sec`;
    return sec > 0 ? `${min} min ${sec} sec` : `${min} min`;
  }

  const started = toMs(input.startedAt);
  const ended = toMs(input.endedAt);
  if (started != null && ended != null && ended > started) {
    const totalSec = Math.round((ended - started) / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min < 1) return `${totalSec} sec`;
    return sec > 0 ? `${min} min ${sec} sec` : `${min} min`;
  }

  return `${input.durationMin} min (allocated)`;
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

test("prefers video duration over inflated wall clock", () => {
  const startedAt = new Date("2026-07-20T11:30:00.000Z");
  const endedAt = new Date("2026-07-20T11:35:23.000Z"); // 5m23s wall clock
  assert.equal(
    formatInterviewDuration({
      startedAt,
      endedAt,
      durationMin: 5,
      videoDurationSec: 300,
    }),
    "5 min",
  );
});

test("falls back to wall clock when no video metadata", () => {
  const startedAt = new Date("2026-07-20T11:30:00.000Z");
  const endedAt = new Date("2026-07-20T11:32:10.000Z");
  assert.equal(
    formatInterviewDuration({
      startedAt,
      endedAt,
      durationMin: 5,
      videoDurationSec: null,
    }),
    "2 min 10 sec",
  );
});

test("falls back to allocated when nothing else is available", () => {
  assert.equal(formatInterviewDuration({ durationMin: 5 }), "5 min (allocated)");
});

test("complete endedAt from durationSec matches allocated slot", () => {
  const startedAt = new Date("2026-07-20T11:30:00.000Z");
  const durationSec = 300;
  const endedAt = new Date(startedAt.getTime() + durationSec * 1000);
  assert.equal(
    formatInterviewDuration({
      startedAt,
      endedAt,
      durationMin: 5,
    }),
    "5 min",
  );
});

test("scales mandatory question count with interview duration", () => {
  assert.equal(computeMandatoryQuestionCount(5), 1);
  assert.equal(computeMandatoryQuestionCount(10), 2);
  assert.equal(computeMandatoryQuestionCount(15), 4);
  assert.equal(computeMandatoryQuestionCount(20), 5);
  assert.equal(computeMandatoryQuestionCount(30), 5);
});

console.log("\nAll interview duration tests passed.");
