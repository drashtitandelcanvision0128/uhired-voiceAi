/**
 * Interview timer regression tests.
 * Run: node scripts/test-interview-timer.mjs
 */
import assert from "node:assert/strict";
import {
  computeRemainingSec,
  resolveDisplayedRemainingSec,
  shouldRestoreInterviewTimer,
} from "../src/lib/interview-timer.ts";

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
}

console.log("Interview timer tests\n");

test("fresh interview shows full duration before live", () => {
  assert.equal(resolveDisplayedRemainingSec("preflight", 1800, 400), 1800);
  assert.equal(resolveDisplayedRemainingSec("connecting", 1800, 400), 1800);
});

test("live stage shows actual remaining time", () => {
  assert.equal(resolveDisplayedRemainingSec("live", 1800, 400), 400);
  assert.equal(resolveDisplayedRemainingSec("ending", 1800, 12), 12);
});

test("computeRemainingSec uses timer anchor when present", () => {
  const now = 1_700_000_000_000;
  const startedAt = now - 900_000;
  assert.equal(computeRemainingSec(1800, startedAt, 1800, now), 900);
});

test("computeRemainingSec falls back when timer not started", () => {
  assert.equal(computeRemainingSec(1800, null, 1500), 1500);
});

test("connecting snapshots should not restore a running timer", () => {
  assert.equal(shouldRestoreInterviewTimer("connecting", false, Date.now()), false);
  assert.equal(shouldRestoreInterviewTimer("connecting", true, null), false);
  assert.equal(shouldRestoreInterviewTimer("live", false, Date.now()), true);
});

test("connecting snapshot with real progress restores timer for resume", () => {
  const startedAt = Date.now() - 10 * 60_000;
  assert.equal(shouldRestoreInterviewTimer("connecting", true, startedAt), true);
});

test("simulate stale connecting restore does not pre-drain a fresh start", () => {
  const durationSec = 1800;
  const staleStartedAt = Date.now() - 20 * 60_000;
  const savedStage = "connecting";

  const restoreTimer = shouldRestoreInterviewTimer(savedStage, false, staleStartedAt)
    ? computeRemainingSec(durationSec, staleStartedAt, durationSec)
    : durationSec;

  const displayBeforeLive = resolveDisplayedRemainingSec("preflight", durationSec, restoreTimer);

  assert.equal(restoreTimer, durationSec);
  assert.equal(displayBeforeLive, durationSec);
});

test("resume after live interruption keeps elapsed time", () => {
  const durationSec = 1800;
  const now = 1_700_000_000_000;
  const startedAt = now - 15 * 60_000;
  const savedStage = "live";

  assert.equal(shouldRestoreInterviewTimer(savedStage, true, startedAt), true);
  const restored = computeRemainingSec(durationSec, startedAt, durationSec, now);
  assert.equal(restored, 900);
  assert.equal(resolveDisplayedRemainingSec("live", durationSec, restored), restored);
});

console.log("\nAll interview timer tests passed.");
