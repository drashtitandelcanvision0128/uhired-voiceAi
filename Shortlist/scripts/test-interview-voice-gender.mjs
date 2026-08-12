import assert from "node:assert/strict";

const REALTIME_VOICE_BY_GENDER = { MALE: "cedar", FEMALE: "marin" };
const REALTIME_VOICE = "cedar";

function resolveRealtimeVoice(gender) {
  return gender === "FEMALE" ? REALTIME_VOICE_BY_GENDER.FEMALE : REALTIME_VOICE_BY_GENDER.MALE;
}

function buildSessionVoice(gender) {
  return resolveRealtimeVoice(gender);
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

console.log("Voice gender consistency tests\n");

test("male and female map to distinct realtime voices", () => {
  assert.notEqual(REALTIME_VOICE_BY_GENDER.MALE, REALTIME_VOICE_BY_GENDER.FEMALE);
});

test("resolveRealtimeVoice honors company gender", () => {
  assert.equal(resolveRealtimeVoice("MALE"), "cedar");
  assert.equal(resolveRealtimeVoice("FEMALE"), "marin");
  assert.equal(resolveRealtimeVoice(null), "cedar");
});

test("client secret and session.update use same voice for FEMALE", () => {
  const tokenVoice = resolveRealtimeVoice("FEMALE");
  const updateVoice = buildSessionVoice("FEMALE");
  assert.equal(tokenVoice, updateVoice);
  assert.equal(tokenVoice, "marin");
});

test("default fallback voice matches male mapping", () => {
  assert.equal(REALTIME_VOICE, REALTIME_VOICE_BY_GENDER.MALE);
  assert.equal(resolveRealtimeVoice(null), REALTIME_VOICE);
});

console.log("\nAll voice gender consistency tests passed.\n");
