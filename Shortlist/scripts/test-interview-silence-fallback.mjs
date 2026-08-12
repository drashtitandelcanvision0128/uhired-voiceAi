/**
 * Simulates silence / empty-answer fallback when scheduling interviewer responses.
 * Run: node scripts/test-interview-silence-fallback.mjs
 */
import assert from "node:assert/strict";
import {
  buildSilenceCheckInResponseInstructions,
  buildNextQuestionResponseInstructions,
  buildPostIntroductionResponseInstructions,
  isSubstantiveCandidateTranscript,
  pickResponseInstructionsAfterCandidateTurn,
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

const TRANSCRIPT_TURN_WAIT_MS = 2000;

function simulateTranscriptAwareScheduling(events, { turnWaitMs = TRANSCRIPT_TURN_WAIT_MS } = {}) {
  let t = 0;
  let gen = 0;
  let utteranceStoppedGen = null;
  const transcriptByGen = new Map();
  const unsettled = new Set();
  const speechStoppedAt = new Map();
  let respondedGen = null;
  let scheduledInstructions = null;
  let schedules = 0;

  const trySchedule = () => {
    const currentGen = gen;
    if (utteranceStoppedGen !== currentGen) return;
    if (respondedGen === currentGen) return;

    const transcriptKnown = transcriptByGen.has(currentGen);
    const stoppedAt = speechStoppedAt.get(currentGen);
    const waitExpired = stoppedAt != null && t - stoppedAt >= turnWaitMs;
    if (!transcriptKnown && !waitExpired && unsettled.has(currentGen)) return;

    const transcript = transcriptByGen.get(currentGen) ?? "";
    scheduledInstructions = pickResponseInstructionsAfterCandidateTurn({
      sessionType: "COMPANY",
      keySkills: ["TypeScript"],
      interviewPhase: "questions",
      candidateTranscript: transcript,
    });
    respondedGen = currentGen;
    schedules += 1;
  };

  for (const event of events) {
    if (event.dt) t += event.dt;

    if (event.type === "speech_started") {
      gen += 1;
      utteranceStoppedGen = null;
    }
    if (event.type === "speech_stopped") {
      utteranceStoppedGen = gen;
      unsettled.add(gen);
      speechStoppedAt.set(gen, t);
      trySchedule();
    }
    if (event.type === "transcription.completed") {
      const eventGen = event.gen ?? gen;
      const transcript = (event.transcript ?? "").trim();
      const wasAlreadyResponded = respondedGen === eventGen;
      transcriptByGen.set(eventGen, transcript);
      unsettled.delete(eventGen);
      if (wasAlreadyResponded && isSubstantiveCandidateTranscript(transcript)) {
        respondedGen = null;
      }
      trySchedule();
    }
    if (event.type === "turn_wait_timeout") {
      if (!transcriptByGen.has(gen)) transcriptByGen.set(gen, "");
      trySchedule();
    }
  }

  return { schedules, scheduledInstructions };
}

console.log("Interview silence fallback simulation tests\n");

test("substantive transcript detector rejects empty and filler", () => {
  assert.equal(isSubstantiveCandidateTranscript(""), false);
  assert.equal(isSubstantiveCandidateTranscript("   "), false);
  assert.equal(isSubstantiveCandidateTranscript("uh"), false);
  assert.equal(isSubstantiveCandidateTranscript("hmm."), false);
  assert.equal(isSubstantiveCandidateTranscript("I led the API migration."), true);
});

test("empty transcript picks silence check-in instead of next question", () => {
  const instructions = pickResponseInstructionsAfterCandidateTurn({
    sessionType: "COMPANY",
    keySkills: [],
    interviewPhase: "questions",
    candidateTranscript: "",
  });
  assert.equal(instructions, buildSilenceCheckInResponseInstructions());
  assert.notEqual(instructions, buildNextQuestionResponseInstructions({ sessionType: "COMPANY" }));
});

test("substantive intro transcript advances to first question instructions", () => {
  const instructions = pickResponseInstructionsAfterCandidateTurn({
    sessionType: "COMPANY",
    keySkills: ["React"],
    interviewPhase: "intro",
    candidateTranscript: "I am a frontend engineer with five years of React experience.",
  });
  assert.equal(
    instructions,
    buildPostIntroductionResponseInstructions({ sessionType: "COMPANY", keySkills: ["React"] }),
  );
});

test("speech_stopped without substantive transcript must not advance to next question", () => {
  const result = simulateTranscriptAwareScheduling([
    { type: "speech_stopped" },
    { type: "transcription.completed", transcript: "mm", dt: 400 },
  ]);
  assert.equal(result.schedules, 1);
  assert.notEqual(
    result.scheduledInstructions,
    buildNextQuestionResponseInstructions({ sessionType: "COMPANY", keySkills: ["TypeScript"] }),
  );
  assert.equal(result.scheduledInstructions, buildSilenceCheckInResponseInstructions());
});

test("fixed model waits for Whisper before scheduling substantive answers", () => {
  const immediate = simulateTranscriptAwareScheduling([{ type: "speech_stopped" }]);
  assert.equal(immediate.schedules, 0, "must defer until Whisper or turn-wait timeout");

  const withWhisper = simulateTranscriptAwareScheduling([
    { type: "speech_stopped" },
    { type: "transcription.completed", transcript: "We used Redis for caching.", dt: 800 },
  ]);
  assert.equal(withWhisper.schedules, 1);
  assert.equal(
    withWhisper.scheduledInstructions,
    buildNextQuestionResponseInstructions({ sessionType: "COMPANY", keySkills: ["TypeScript"] }),
  );
});

test("empty Whisper result triggers silence check-in not next question", () => {
  const result = simulateTranscriptAwareScheduling([
    { type: "speech_stopped" },
    { type: "transcription.completed", transcript: "", dt: 500 },
  ]);
  assert.equal(result.schedules, 1);
  assert.equal(result.scheduledInstructions, buildSilenceCheckInResponseInstructions());
});

test("turn-wait timeout treats missing Whisper as silence", () => {
  const result = simulateTranscriptAwareScheduling([
    { type: "speech_stopped" },
    { type: "turn_wait_timeout", dt: TRANSCRIPT_TURN_WAIT_MS },
  ]);
  assert.equal(result.schedules, 1);
  assert.equal(result.scheduledInstructions, buildSilenceCheckInResponseInstructions());
});

test("late substantive Whisper after turn-wait timeout reschedules with next question", () => {
  const result = simulateTranscriptAwareScheduling([
    { type: "speech_stopped" },
    { type: "turn_wait_timeout", dt: TRANSCRIPT_TURN_WAIT_MS },
    {
      type: "transcription.completed",
      transcript: "We used Redis for caching.",
      dt: 600,
    },
  ]);
  assert.equal(result.schedules, 2);
  assert.equal(
    result.scheduledInstructions,
    buildNextQuestionResponseInstructions({ sessionType: "COMPANY", keySkills: ["TypeScript"] }),
  );
});

console.log("\nAll silence fallback simulation tests passed.");
