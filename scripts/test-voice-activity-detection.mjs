/**
 * Unit tests for voice activity detection heuristics.
 * Run: node scripts/test-voice-activity-detection.mjs
 */
import assert from "node:assert/strict";
import {
  buildServerVadTurnDetection,
  classifyAudioFrame,
  computeDynamicSilenceDurationMs,
  extractAudioFrameFeatures,
  resolveVadConfig,
  validateSpeechStart,
} from "../src/lib/voice-activity-detection.ts";

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
}

function frame(partial) {
  return {
    rms: 0,
    speechBandRatio: 0,
    highBandRatio: 0,
    zeroCrossingRate: 0,
    crestFactor: 1,
    timestampMs: Date.now(),
    ...partial,
  };
}

console.log("Voice activity detection tests\n");

test("defaults match prior production tuning", () => {
  const config = resolveVadConfig({});
  assert.equal(config.threshold, 0.6);
  assert.equal(config.silenceBaseMs, 3_000);
  assert.equal(config.prefixPaddingMs, 300);
});

test("env overrides are applied", () => {
  const config = resolveVadConfig({
    VAD_THRESHOLD: "0.72",
    VAD_SILENCE_BASE_MS: "4200",
  });
  assert.equal(config.threshold, 0.72);
  assert.equal(config.silenceBaseMs, 4_200);
});

test("classifies keyboard transients", () => {
  const config = resolveVadConfig({});
  const soundClass = classifyAudioFrame(
    frame({ rms: 0.05, highBandRatio: 0.5, crestFactor: 5.5, speechBandRatio: 0.1 }),
    config,
    0.01,
  );
  assert.equal(soundClass, "keyboard");
});

test("classifies breathing", () => {
  const config = resolveVadConfig({});
  const soundClass = classifyAudioFrame(
    frame({ rms: 0.02, speechBandRatio: 0.1, zeroCrossingRate: 0.04 }),
    config,
    0.01,
  );
  assert.equal(soundClass, "breathing");
});

test("classifies near-field speech", () => {
  const config = resolveVadConfig({});
  const soundClass = classifyAudioFrame(
    frame({ rms: 0.12, speechBandRatio: 0.5, zeroCrossingRate: 0.12 }),
    config,
    0.01,
  );
  assert.equal(soundClass, "speech");
});

test("rejects keyboard-only speech_started validation", () => {
  const config = resolveVadConfig({});
  const validation = validateSpeechStart(
    [
      frame({ rms: 0.05, highBandRatio: 0.5, crestFactor: 5.5, speechBandRatio: 0.1 }),
      frame({ rms: 0.04, highBandRatio: 0.48, crestFactor: 5.1, speechBandRatio: 0.09 }),
      frame({ rms: 0.03, highBandRatio: 0.45, crestFactor: 4.8, speechBandRatio: 0.08 }),
    ],
    config,
    0.01,
  );
  assert.equal(validation.accept, false);
  assert.equal(validation.soundClass, "keyboard");
});

test("accepts sustained near-field speech", () => {
  const config = resolveVadConfig({});
  const validation = validateSpeechStart(
    Array.from({ length: 4 }, () =>
      frame({ rms: 0.11, speechBandRatio: 0.48, zeroCrossingRate: 0.1, crestFactor: 2.1 }),
    ),
    config,
    0.01,
  );
  assert.equal(validation.accept, true);
  assert.equal(validation.soundClass, "speech");
});

test("dynamic silence grows for long thoughtful answers", () => {
  const config = resolveVadConfig({});
  const shortPause = computeDynamicSilenceDurationMs(config, {
    utteranceDurationMs: 4_000,
    midUtterancePauseCount: 0,
    lastUtteranceWasSubstantive: false,
  });
  const longPause = computeDynamicSilenceDurationMs(config, {
    utteranceDurationMs: 18_000,
    midUtterancePauseCount: 2,
    lastUtteranceWasSubstantive: true,
  });
  assert.ok(longPause > shortPause);
  assert.ok(longPause <= config.silenceMaxMs);
  assert.ok(shortPause >= config.silenceMinMs);
});

test("buildServerVadTurnDetection clamps silence duration", () => {
  const config = resolveVadConfig({});
  const turnDetection = buildServerVadTurnDetection(config, 99_999);
  assert.equal(turnDetection.type, "server_vad");
  assert.equal(turnDetection.threshold, 0.6);
  assert.equal(turnDetection.silence_duration_ms, config.silenceMaxMs);
});

test("extractAudioFrameFeatures derives speech-band ratio", () => {
  const bins = new Uint8Array(128);
  for (let i = 0; i < bins.length; i += 1) {
    const hz = (i / bins.length) * 12_000;
    bins[i] = hz >= 400 && hz <= 2_500 ? 200 : 20;
  }
  const features = extractAudioFrameFeatures(bins, 24_000, 0);
  assert.ok(features.speechBandRatio > 0.5);
  assert.ok(features.rms > 0);
});

console.log("\nAll voice activity detection tests passed.");
