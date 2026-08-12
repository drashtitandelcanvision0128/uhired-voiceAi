/**
 * Comprehensive interview E2E / integration test suite.
 *
 * Covers:
 *  1. Complete interview flow
 *  2. Speech recognition
 *  3. Evaluation pipeline
 *  4. Reconnect handling
 *  5. Browser refresh / sessionStorage recovery
 *  6. Duplicate prevention
 *  7. Long answers
 *  8. Silent users
 *  9. Background noise
 * 10. API failures
 * 11. Session recovery
 * 12. Automated test reports (via harness)
 *
 * Run: npx tsx --env-file=.env scripts/qa-interview-e2e-comprehensive.mjs
 * Optional browser checks: QA_RUN_BROWSER=1 npx tsx --env-file=.env scripts/qa-interview-e2e-comprehensive.mjs
 */
import assert from "node:assert/strict";
import {
  DEFAULT_BASE_URL,
  assertCondition,
  checkServerReachable,
  clearInterviewState,
  computeReconnectBackoffMs,
  createDuplicateResponseGuard,
  createPreviewSession,
  createSessionStorageSimulator,
  createSuite,
  fetchJson,
  loadInterviewState,
  saveInterviewState,
  writeTestReport,
} from "./lib/e2e-harness.mjs";

import {
  buildTranscriptionPrompt,
  confidenceFromLogprobs,
  isLikelyNoiseTranscript,
  processCandidateTranscript,
} from "../src/lib/speech-transcription.ts";
import {
  DEFAULT_TRANSCRIPTION_CONFIDENCE_MAX_RETRIES,
  DEFAULT_TRANSCRIPTION_CONFIDENCE_THRESHOLD,
  validateTranscriptConfidence,
} from "../src/lib/transcript-confidence-validation.ts";
import {
  InterviewConversationManager,
  detectRepeatRequest,
} from "../src/lib/interview-conversation-state.ts";
import {
  buildSilenceCheckInResponseInstructions,
  buildLowConfidenceRepeatResponseInstructions,
  isSubstantiveCandidateTranscript,
  pickResponseInstructionsAfterCandidateTurn,
} from "../src/lib/interview-prompt.ts";
import {
  classifyAudioFrame,
  computeDynamicSilenceDurationMs,
  resolveVadConfig,
  validateSpeechStart,
} from "../src/lib/voice-activity-detection.ts";
import { cosineSimilarity, clampSimilarity } from "../src/lib/semantic-evaluation.ts";
import { preprocessSpokenAnswer } from "../src/lib/answer-preprocessing.ts";
import { buildScorecard } from "../src/lib/scoring.ts";

const BASE_URL = DEFAULT_BASE_URL;
const serverAvailable = await checkServerReachable(BASE_URL);
const runBrowser = process.env.QA_RUN_BROWSER === "1";

const suite = createSuite("interview-e2e-comprehensive");
suite.info(`Base URL: ${BASE_URL}`);
suite.info(`Server reachable: ${serverAvailable}`);
suite.info(`Browser checks: ${runBrowser ? "enabled" : "disabled (set QA_RUN_BROWSER=1)"}`);

// ---------------------------------------------------------------------------
// 1. Complete interview flow (API integration)
// ---------------------------------------------------------------------------
await suite.runCase(
  "flow-01-preview-session-create",
  "Create preview practice session via API",
  async ({ log }) => {
    assertCondition(serverAvailable, `Dev server not reachable at ${BASE_URL}`);
    const session = await createPreviewSession(BASE_URL);
    log("Created preview session", { sessionId: session.sessionId });
    assert.ok(session.sessionId);
    assert.ok(session.accessCode?.startsWith("PRC"));
  },
  { requirement: "1. Complete interview flow" },
);

let flowSessionId = null;
await suite.runCase(
  "flow-02-session-details-ready",
  "Load session details while READY",
  async ({ log }) => {
    assertCondition(serverAvailable, `Dev server not reachable at ${BASE_URL}`);
    const created = await createPreviewSession(BASE_URL);
    flowSessionId = created.sessionId;
    const { data, ok, status } = await fetchJson(`${BASE_URL}/api/interview/${flowSessionId}/details`);
    assert.equal(status, 200);
    assert.ok(ok);
    assert.equal(data.session.status, "READY");
    assert.equal(data.session.sessionType, "PRACTICE");
    log("Session details OK", { status: data.session.status, candidate: data.session.candidateName });
  },
  { requirement: "1. Complete interview flow" },
);

await suite.runCase(
  "flow-03-go-live-and-complete",
  "Transition LIVE → complete with transcript → COMPLETED scorecard",
  async ({ log }) => {
    assertCondition(serverAvailable, `Dev server not reachable at ${BASE_URL}`);
    const created = await createPreviewSession(BASE_URL);
    const sessionId = created.sessionId;

    const live = await fetchJson(`${BASE_URL}/api/interview/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "LIVE", markStartedAt: true }),
    });
    assert.equal(live.status, 200);
    log("Session marked LIVE");

    const transcript = [
      { speaker: "interviewer", text: "Please introduce yourself.", orderIndex: 0 },
      {
        speaker: "candidate",
        text: "I am a backend engineer with experience in Node.js, PostgreSQL, and distributed systems.",
        orderIndex: 1,
        confidence: 0.94,
      },
      {
        speaker: "interviewer",
        text: "How do you handle production incidents?",
        orderIndex: 2,
      },
      {
        speaker: "candidate",
        text: "I follow runbooks, triage severity, communicate in Slack, and write postmortems.",
        orderIndex: 3,
        confidence: 0.91,
      },
    ];

    const complete = await fetchJson(`${BASE_URL}/api/interview/${sessionId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationSec: 120, transcript }),
    });
    assert.equal(complete.status, 200);
    assert.ok(complete.data.ok);
    assert.ok(complete.data.score?.overallScore >= 0);
    log("Interview completed", {
      overallScore: complete.data.score?.overallScore,
      gradingPending: complete.data.gradingPending,
    });

    const details = await fetchJson(`${BASE_URL}/api/interview/${sessionId}/details`);
    assert.equal(details.data.session.status, "COMPLETED");
    log("Final session status COMPLETED");
  },
  { requirement: "1. Complete interview flow" },
);

// ---------------------------------------------------------------------------
// 2. Speech recognition
// ---------------------------------------------------------------------------
await suite.runCase(
  "speech-01-domain-prompt",
  "Transcription prompt includes role vocabulary",
  async () => {
    const prompt = buildTranscriptionPrompt({
      domain: "Engineering",
      topic: "Backend",
      positionTitle: "Senior Node.js Developer",
      keySkills: ["Node.js", "PostgreSQL"],
      jobDescription: "Build scalable APIs.",
    });
    assert.match(prompt, /Node\.js/);
    assert.match(prompt, /PostgreSQL/);
  },
  { requirement: "2. Speech recognition" },
);

await suite.runCase(
  "speech-02-confidence-scoring",
  "Logprob confidence scoring accepts high-quality ASR",
  async () => {
    const confidence = confidenceFromLogprobs([{ logprob: -0.05 }, { logprob: -0.08 }]);
    assert.ok(confidence !== null && confidence > 0.9);
    const validation = validateTranscriptConfidence({
      text: "We migrated the monolith to microservices.",
      confidence,
      rejectedAsNoise: false,
      retryCount: 0,
      config: {
        threshold: DEFAULT_TRANSCRIPTION_CONFIDENCE_THRESHOLD,
        maxRetries: DEFAULT_TRANSCRIPTION_CONFIDENCE_MAX_RETRIES,
      },
    });
    assert.equal(validation.accepted, true);
  },
  { requirement: "2. Speech recognition" },
);

await suite.runCase(
  "speech-03-post-processing",
  "Candidate transcript post-processing normalizes spoken answers",
  async () => {
    const result = processCandidateTranscript(
      "we used kubernetes for container orchestration",
      [{ logprob: -0.05 }, { logprob: -0.08 }],
    );
    assert.equal(result.rejectedAsNoise, false);
    assert.match(result.text, /^We used kubernetes/);
  },
  { requirement: "2. Speech recognition" },
);

// ---------------------------------------------------------------------------
// 3. Evaluation pipeline
// ---------------------------------------------------------------------------
await suite.runCase(
  "eval-01-fsm-substantive-advance",
  "Conversation FSM advances on substantive answers",
  async () => {
    const manager = new InterviewConversationManager({
      sessionType: "COMPANY",
      keySkills: ["React"],
      predefinedQuestions: ["How do you handle production incidents?"],
      logTransitions: false,
    });
    manager.onOpeningComplete("Please introduce yourself.");
    manager.onTranscriptReceived("I am a senior React engineer with eight years of experience.");
    manager.onInterviewerResponseScheduled();
    assert.equal(manager.interviewPhase, "questions");
    const instructions = manager.getResponseInstructions();
    assert.ok(instructions);
    assert.match(instructions, /production incidents/i);
  },
  { requirement: "3. Evaluation pipeline" },
);

await suite.runCase(
  "eval-02-semantic-similarity",
  "Semantic evaluation cosine similarity ranks related answers",
  async () => {
    const identical = cosineSimilarity([1, 0, 0], [1, 0, 0]);
    const orthogonal = cosineSimilarity([1, 0, 0], [0, 1, 0]);
    assert.ok(Math.abs(identical - 1) < 0.001);
    assert.ok(Math.abs(orthogonal) < 0.001);
    const preprocessed = preprocessSpokenAnswer(
      "Um, React uses a virtual DOM for efficient updates.",
    );
    assert.ok(preprocessed.removedFillerCount >= 1);
    assert.match(preprocessed.cleaned, /virtual dom/i);
  },
  { requirement: "3. Evaluation pipeline" },
);

await suite.runCase(
  "eval-03-heuristic-scorecard",
  "Heuristic scorecard produces valid scores from transcript",
  async () => {
    const score = buildScorecard({
      turns: [
        { speaker: "INTERVIEWER", message: "Tell me about your experience." },
        {
          speaker: "CANDIDATE",
          message:
            "I have led backend teams building APIs with Node.js, PostgreSQL, caching, and observability.",
        },
      ],
      domain: "Engineering",
      topic: "Backend",
      keySkills: ["Node.js"],
    });
    assert.ok(score.overallScore >= 0 && score.overallScore <= 100);
    assert.ok(score.summary.length >= 10);
    assert.ok(score.strengths.length >= 2);
  },
  { requirement: "3. Evaluation pipeline" },
);

// ---------------------------------------------------------------------------
// 4. Reconnect handling
// ---------------------------------------------------------------------------
await suite.runCase(
  "reconnect-01-fsm-serialize-restore",
  "Conversation state serializes and restores for reconnect",
  async () => {
    const manager = new InterviewConversationManager({
      sessionType: "PRACTICE",
      keySkills: ["TypeScript"],
      predefinedQuestions: ["Describe your testing strategy."],
      logTransitions: false,
    });
    manager.onOpeningComplete("Please introduce yourself.");
    manager.onTranscriptReceived("I am a full-stack engineer focused on TypeScript.");
    manager.onInterviewerResponseScheduled();
    const snapshot = manager.serialize();

    const restored = new InterviewConversationManager({
      sessionType: "PRACTICE",
      keySkills: ["TypeScript"],
      predefinedQuestions: ["Describe your testing strategy."],
      logTransitions: false,
    });
    restored.restore(snapshot);
    assert.equal(restored.interviewPhase, "questions");
    assert.equal(restored.snapshot.currentEvaluationStatus, "substantive");
  },
  { requirement: "4. Reconnect handling" },
);

await suite.runCase(
  "reconnect-02-backoff-schedule",
  "Reconnect backoff grows exponentially up to cap",
  async () => {
    assert.equal(computeReconnectBackoffMs(1), 800);
    assert.equal(computeReconnectBackoffMs(2), 1600);
    assert.equal(computeReconnectBackoffMs(3), 3200);
    assert.equal(computeReconnectBackoffMs(10), 15_000);
  },
  { requirement: "4. Reconnect handling" },
);

await suite.runCase(
  "reconnect-03-realtime-resume-live-session",
  "Realtime token endpoint accepts LIVE practice session resume",
  async ({ log }) => {
    assertCondition(serverAvailable, `Dev server not reachable at ${BASE_URL}`);
    const created = await createPreviewSession(BASE_URL);
    await fetchJson(`${BASE_URL}/api/interview/${created.sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "LIVE", deferStartedAt: true }),
    });

    const realtime = await fetchJson(`${BASE_URL}/api/interview/${created.sessionId}/realtime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.ok([200, 201].includes(realtime.status), `Expected 200/201, got ${realtime.status}`);
    assert.ok(
      realtime.data.realtimeToken || realtime.data.clientSecret || realtime.data.ephemeralKey,
      `Missing realtime token in response: ${JSON.stringify(realtime.data).slice(0, 200)}`,
    );
    log("Realtime client secret issued for LIVE session");
  },
  {
    requirement: "4. Reconnect handling",
    skipIf: () => {
      if (!serverAvailable) return `Server not reachable at ${BASE_URL}`;
      if (!process.env.OPENAI_API_KEY?.trim()) return "OPENAI_API_KEY not configured";
      return null;
    },
  },
);

// ---------------------------------------------------------------------------
// 5. Browser refresh (sessionStorage)
// ---------------------------------------------------------------------------
await suite.runCase(
  "refresh-01-save-load-state",
  "sessionStorage snapshot saves and loads interview progress",
  async () => {
    const storage = createSessionStorageSimulator();
    const sessionId = "sess-refresh-test";
    const payload = {
      sessionId,
      stage: "live",
      remainingSec: 540,
      transcript: [
        { speaker: "interviewer", text: "Hello.", orderIndex: 0 },
        { speaker: "candidate", text: "Hi there.", orderIndex: 1 },
      ],
      timerStartedAt: Date.now() - 60_000,
      conversationState: {
        sessionPhase: "intro",
        turnPhase: "awaiting_answer",
        currentQuestion: { id: "q1", text: "Introduce yourself.", source: "intro" },
        currentAnswerText: null,
        currentEvaluationStatus: "pending",
        awaitingFollowUpAnswer: false,
        previousQuestions: [],
        repeatExplicitlyRequested: false,
        transcriptRetryCount: 0,
        lastInterviewerUtterance: "Introduce yourself.",
        nextPredefinedIndex: 0,
        assessedSkillCount: 0,
        version: 1,
      },
      savedAt: Date.now(),
    };
    saveInterviewState(storage, sessionId, payload);
    const loaded = loadInterviewState(storage, sessionId);
    assert.ok(loaded);
    assert.equal(loaded.stage, "live");
    assert.equal(loaded.transcript.length, 2);
    assert.equal(loaded.conversationState.sessionPhase, "intro");
  },
  { requirement: "5. Browser refresh" },
);

await suite.runCase(
  "refresh-02-reject-stale-or-mismatched",
  "Expired or mismatched sessionStorage snapshots are rejected",
  async () => {
    const storage = createSessionStorageSimulator();
    saveInterviewState(storage, "sess-a", {
      sessionId: "sess-b",
      stage: "live",
      remainingSec: 100,
      transcript: [],
      timerStartedAt: null,
      savedAt: Date.now(),
    });
    assert.equal(loadInterviewState(storage, "sess-a"), null);

    saveInterviewState(storage, "sess-old", {
      sessionId: "sess-old",
      stage: "live",
      remainingSec: 100,
      transcript: [],
      timerStartedAt: null,
      savedAt: Date.now() - 25 * 60 * 60 * 1000,
    });
    assert.equal(loadInterviewState(storage, "sess-old"), null);
    clearInterviewState(storage, "sess-old");
    assert.equal(loadInterviewState(storage, "sess-old"), null);
  },
  { requirement: "5. Browser refresh" },
);

await suite.runCase(
  "refresh-03-browser-reload-shows-reconnect",
  "Browser reload surfaces reconnect prompt for interrupted LIVE session",
  async ({ log }) => {
    assertCondition(runBrowser, "Set QA_RUN_BROWSER=1 to run Playwright refresh check");
    assertCondition(serverAvailable, `Dev server not reachable at ${BASE_URL}`);

    const created = await createPreviewSession(BASE_URL);
    await fetchJson(`${BASE_URL}/api/interview/${created.sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "LIVE", deferStartedAt: true }),
    });

    const playwright = await import("playwright");
    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const storageKey = `interview_state_${created.sessionId}`;
    const saved = {
      sessionId: created.sessionId,
      stage: "live",
      remainingSec: 120,
      transcript: [{ speaker: "interviewer", text: "Welcome.", orderIndex: 0 }],
      timerStartedAt: Date.now(),
      savedAt: Date.now(),
    };

    await page.goto(`${BASE_URL}/interview/${created.sessionId}`, { waitUntil: "networkidle" });
    await page.evaluate(
      ({ key, value }) => sessionStorage.setItem(key, value),
      { key: storageKey, value: JSON.stringify(saved) },
    );
    await page.reload({ waitUntil: "networkidle" });

    const bodyText = await page.locator("body").innerText();
    assert.match(bodyText, /reconnect|Start voice interview|interrupted/i);
    log("Reconnect prompt visible after refresh");
    await browser.close();
  },
  {
    requirement: "5. Browser refresh",
    skipIf: () => {
      if (!runBrowser) return "QA_RUN_BROWSER not set";
      if (!serverAvailable) return `Server not reachable at ${BASE_URL}`;
      return null;
    },
  },
);

// ---------------------------------------------------------------------------
// 6. Duplicate prevention
// ---------------------------------------------------------------------------
await suite.runCase(
  "dup-01-response-create-debounce",
  "Duplicate response.create events are debounced while in-flight",
  async () => {
    const guard = createDuplicateResponseGuard();
    const first = guard.sendRealtimeEvent({ type: "response.create" }, { utteranceGen: 1 });
    const second = guard.sendRealtimeEvent({ type: "response.create" }, { utteranceGen: 1 });
    assert.equal(first, true);
    assert.equal(second, false);
    assert.equal(guard.responseInFlight, true);
    guard.sendRealtimeEvent({ type: "response.done" });
    assert.equal(guard.responseInFlight, false);
  },
  { requirement: "6. Duplicate prevention" },
);

await suite.runCase(
  "dup-02-duplicate-complete-idempotent",
  "Completing an already COMPLETED session is idempotent",
  async ({ log }) => {
    assertCondition(serverAvailable, `Dev server not reachable at ${BASE_URL}`);
    const created = await createPreviewSession(BASE_URL);
    const sessionId = created.sessionId;
    await fetchJson(`${BASE_URL}/api/interview/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "LIVE" }),
    });
    const first = await fetchJson(`${BASE_URL}/api/interview/${sessionId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationSec: 60, transcript: [] }),
    });
    assert.ok(first.data.ok);
    const second = await fetchJson(`${BASE_URL}/api/interview/${sessionId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationSec: 60, transcript: [] }),
    });
    assert.equal(second.status, 200);
    assert.equal(second.data.alreadyFinalized, true);
    log("Duplicate complete returned alreadyFinalized");
  },
  { requirement: "6. Duplicate prevention" },
);

await suite.runCase(
  "dup-03-preview-rate-limit",
  "Duplicate free preview for same email is rejected within 24h",
  async ({ log }) => {
    assertCondition(serverAvailable, `Dev server not reachable at ${BASE_URL}`);
    const email = `dup-preview-${Date.now()}@example.com`;
    const first = await createPreviewSession(BASE_URL, { email });
    assert.ok(first.sessionId);
    const { response, data, status } = await fetchJson(`${BASE_URL}/api/practice/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateName: "Dup Tester",
        email,
        domain: "Engineering",
        topic: "Backend",
        durationMin: 3,
        preview: true,
      }),
    });
    assert.equal(status, 429);
    assert.match(data.error ?? "", /preview today/i);
    log("Second preview blocked", { status });
  },
  { requirement: "6. Duplicate prevention" },
);

// ---------------------------------------------------------------------------
// 7. Long answers
// ---------------------------------------------------------------------------
await suite.runCase(
  "long-01-dynamic-silence-window",
  "VAD extends silence window for long thoughtful answers",
  async () => {
    const config = resolveVadConfig();
    const short = computeDynamicSilenceDurationMs(config, {
      utteranceDurationMs: 4_000,
      midUtterancePauseCount: 0,
      lastUtteranceWasSubstantive: false,
    });
    const long = computeDynamicSilenceDurationMs(config, {
      utteranceDurationMs: 120_000,
      midUtterancePauseCount: 4,
      lastUtteranceWasSubstantive: true,
    });
    assert.ok(long > short);
    assert.ok(long <= config.silenceMaxMs);
  },
  { requirement: "7. Long answers" },
);

await suite.runCase(
  "long-02-substantive-long-transcript",
  "FSM accepts very long substantive candidate answers",
  async () => {
    const longAnswer = `${"I designed a distributed caching layer with Redis and wrote runbooks. ".repeat(40)}`.trim();
    assert.ok(isSubstantiveCandidateTranscript(longAnswer));
    const manager = new InterviewConversationManager({
      sessionType: "COMPANY",
      keySkills: ["Distributed Systems"],
      predefinedQuestions: ["How do you design for scale?"],
      logTransitions: false,
    });
    manager.onOpeningComplete("Please introduce yourself.");
    manager.onTranscriptReceived(longAnswer);
    assert.equal(manager.snapshot.currentEvaluationStatus, "substantive");
    assert.equal(manager.canAdvanceToNextQuestion(), true);
  },
  { requirement: "7. Long answers" },
);

// ---------------------------------------------------------------------------
// 8. Silent users
// ---------------------------------------------------------------------------
await suite.runCase(
  "silent-01-empty-transcript-check-in",
  "Empty transcript triggers silence check-in, not next question",
  async () => {
    const instructions = pickResponseInstructionsAfterCandidateTurn({
      sessionType: "COMPANY",
      keySkills: ["React"],
      interviewPhase: "questions",
      candidateTranscript: "",
    });
    assert.equal(instructions, buildSilenceCheckInResponseInstructions());
  },
  { requirement: "8. Silent users" },
);

await suite.runCase(
  "silent-02-fsm-empty-never-advances",
  "FSM does not advance on empty candidate speech",
  async () => {
    const manager = new InterviewConversationManager({
      sessionType: "COMPANY",
      keySkills: ["React"],
      predefinedQuestions: ["How do you handle incidents?"],
      logTransitions: false,
    });
    manager.onOpeningComplete("Please introduce yourself.");
    manager.onCandidateSpeechStarted();
    manager.onCandidateSpeechStopped();
    manager.onTranscriptReceived("");
    assert.equal(manager.snapshot.currentEvaluationStatus, "empty");
    assert.equal(manager.canAdvanceToNextQuestion(), false);
    assert.equal(manager.getResponseInstructions(), buildSilenceCheckInResponseInstructions());
  },
  { requirement: "8. Silent users" },
);

// ---------------------------------------------------------------------------
// 9. Background noise
// ---------------------------------------------------------------------------
await suite.runCase(
  "noise-01-transcript-filter",
  "ASR post-processing rejects keyboard and filler noise",
  async () => {
    assert.equal(isLikelyNoiseTranscript("click click", 0.9), true);
    assert.equal(isLikelyNoiseTranscript("typing", 0.9), true);
    const noise = processCandidateTranscript("uh", [{ logprob: -0.2 }]);
    assert.equal(noise.rejectedAsNoise, true);
    const speech = processCandidateTranscript("I deployed with Kubernetes.", [{ logprob: -0.1 }]);
    assert.equal(speech.rejectedAsNoise, false);
  },
  { requirement: "9. Background noise" },
);

await suite.runCase(
  "noise-02-vad-classification",
  "Client VAD classifies keyboard and breathing separately from speech",
  async () => {
    const config = resolveVadConfig();
    const noiseFloor = 0.01;

    const keyboard = classifyAudioFrame(
      {
        rms: 0.05,
        speechBandRatio: 0.1,
        highBandRatio: 0.5,
        zeroCrossingRate: 0.5,
        crestFactor: 5.5,
        timestampMs: 0,
      },
      config,
      noiseFloor,
    );
    assert.equal(keyboard, "keyboard");

    const breathing = classifyAudioFrame(
      {
        rms: 0.02,
        speechBandRatio: 0.1,
        highBandRatio: 0.1,
        zeroCrossingRate: 0.04,
        crestFactor: 2,
        timestampMs: 0,
      },
      config,
      noiseFloor,
    );
    assert.equal(breathing, "breathing");

    const validation = validateSpeechStart(
      [
        {
          rms: 0.05,
          speechBandRatio: 0.1,
          highBandRatio: 0.5,
          zeroCrossingRate: 0.5,
          crestFactor: 5.5,
          timestampMs: 0,
        },
        {
          rms: 0.04,
          speechBandRatio: 0.09,
          highBandRatio: 0.48,
          zeroCrossingRate: 0.48,
          crestFactor: 5.1,
          timestampMs: 20,
        },
        {
          rms: 0.03,
          speechBandRatio: 0.08,
          highBandRatio: 0.45,
          zeroCrossingRate: 0.45,
          crestFactor: 4.8,
          timestampMs: 40,
        },
      ],
      config,
      noiseFloor,
    );
    assert.equal(validation.accept, false);
    assert.equal(validation.soundClass, "keyboard");
  },
  { requirement: "9. Background noise" },
);

// ---------------------------------------------------------------------------
// 10. API failures
// ---------------------------------------------------------------------------
await suite.runCase(
  "api-01-unknown-session-404",
  "Unknown session returns 404 from details endpoint",
  async () => {
    assertCondition(serverAvailable, `Dev server not reachable at ${BASE_URL}`);
    const { status, data } = await fetchJson(`${BASE_URL}/api/interview/does-not-exist/details`);
    assert.equal(status, 404);
    assert.match(data.error ?? "", /not found/i);
  },
  { requirement: "10. API failures" },
);

await suite.runCase(
  "api-02-completed-realtime-409",
  "Realtime token rejected for COMPLETED session",
  async () => {
    assertCondition(serverAvailable, `Dev server not reachable at ${BASE_URL}`);
    const created = await createPreviewSession(BASE_URL);
    await fetchJson(`${BASE_URL}/api/interview/${created.sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "LIVE" }),
    });
    await fetchJson(`${BASE_URL}/api/interview/${created.sessionId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationSec: 30, transcript: [] }),
    });
    const realtime = await fetchJson(`${BASE_URL}/api/interview/${created.sessionId}/realtime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(realtime.status, 409);
    assert.match(realtime.data.error ?? "", /completed/i);
  },
  { requirement: "10. API failures" },
);

await suite.runCase(
  "api-03-invalid-practice-body-400",
  "Invalid practice start payload returns 400 with message",
  async () => {
    assertCondition(serverAvailable, `Dev server not reachable at ${BASE_URL}`);
    const { status, data } = await fetchJson(`${BASE_URL}/api/practice/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateName: "",
        email: "not-an-email",
        domain: "",
        topic: "",
        durationMin: 3,
        preview: true,
      }),
    });
    assert.equal(status, 400);
    assert.ok(data.error);
  },
  { requirement: "10. API failures" },
);

// ---------------------------------------------------------------------------
// 11. Session recovery
// ---------------------------------------------------------------------------
await suite.runCase(
  "recovery-01-live-only-restore",
  "Recovery clears snapshot when server session is not LIVE",
  async ({ log }) => {
    assertCondition(serverAvailable, `Dev server not reachable at ${BASE_URL}`);
    const created = await createPreviewSession(BASE_URL);
    const storage = createSessionStorageSimulator();
    saveInterviewState(storage, created.sessionId, {
      sessionId: created.sessionId,
      stage: "live",
      remainingSec: 200,
      transcript: [],
      timerStartedAt: Date.now(),
      savedAt: Date.now(),
    });

    const details = await fetchJson(`${BASE_URL}/api/interview/${created.sessionId}/details`);
    assert.equal(details.data.session.status, "READY");

    // Client recovery path: only restore when LIVE
    const shouldRestore = details.data.session.status === "LIVE";
    if (!shouldRestore) {
      clearInterviewState(storage, created.sessionId);
    }
    assert.equal(loadInterviewState(storage, created.sessionId), null);
    log("Stale READY snapshot cleared (expected before go-live)");
  },
  { requirement: "11. Session recovery" },
);

await suite.runCase(
  "recovery-02-restore-after-go-live",
  "Recovery retains snapshot when server session is LIVE",
  async ({ log }) => {
    assertCondition(serverAvailable, `Dev server not reachable at ${BASE_URL}`);
    const created = await createPreviewSession(BASE_URL);
    await fetchJson(`${BASE_URL}/api/interview/${created.sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "LIVE", deferStartedAt: true }),
    });

    const storage = createSessionStorageSimulator();
    const manager = new InterviewConversationManager({
      sessionType: "PRACTICE",
      keySkills: ["Node.js"],
      predefinedQuestions: [],
      logTransitions: false,
    });
    manager.onOpeningComplete("Tell me about yourself.");
    saveInterviewState(storage, created.sessionId, {
      sessionId: created.sessionId,
      stage: "live",
      remainingSec: 150,
      transcript: [{ speaker: "interviewer", text: "Tell me about yourself.", orderIndex: 0 }],
      timerStartedAt: Date.now(),
      conversationState: manager.serialize(),
      savedAt: Date.now(),
    });

    const details = await fetchJson(`${BASE_URL}/api/interview/${created.sessionId}/details`);
    assert.equal(details.data.session.status, "LIVE");
    const restored = loadInterviewState(storage, created.sessionId);
    assert.ok(restored);
    assert.equal(restored.conversationState.sessionPhase, "intro");

    const rehydrated = new InterviewConversationManager({
      sessionType: "PRACTICE",
      keySkills: ["Node.js"],
      predefinedQuestions: [],
      logTransitions: false,
    });
    rehydrated.restore(restored.conversationState);
    assert.equal(rehydrated.snapshot.turnPhase, "awaiting_answer");
    log("LIVE session snapshot restored with conversation state");
  },
  { requirement: "11. Session recovery" },
);

await suite.runCase(
  "recovery-03-repeat-request-after-restore",
  "Restored session still handles repeat requests correctly",
  async () => {
    const manager = new InterviewConversationManager({
      sessionType: "COMPANY",
      keySkills: ["React"],
      predefinedQuestions: ["Explain reconciliation in React."],
      logTransitions: false,
    });
    manager.onOpeningComplete("Explain reconciliation in React.");
    const saved = manager.serialize();
    const restored = new InterviewConversationManager({
      sessionType: "COMPANY",
      keySkills: ["React"],
      predefinedQuestions: ["Explain reconciliation in React."],
      logTransitions: false,
    });
    restored.restore(saved);
    restored.onTranscriptReceived("Sorry, can you repeat the question?");
    assert.equal(restored.snapshot.repeatExplicitlyRequested, true);
    assert.equal(detectRepeatRequest("Sorry, can you repeat the question?"), true);
    assert.equal(restored.canAdvanceToNextQuestion(), false);
  },
  { requirement: "11. Session recovery" },
);

// ---------------------------------------------------------------------------
// Finalize report
// ---------------------------------------------------------------------------
const summary = suite.summary();
const report = {
  ...summary,
  baseUrl: BASE_URL,
  serverAvailable,
  browserChecksEnabled: runBrowser,
  environment: {
    node: process.version,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
  },
};

const paths = await writeTestReport(report, { label: "interview-e2e-comprehensive" });

console.log("\n=== Interview E2E Comprehensive Summary ===");
console.log(`Passed: ${summary.passed}  Failed: ${summary.failed}  Skipped: ${summary.skipped}`);
console.log(`JSON report: ${paths.jsonPath}`);
console.log(`HTML report: ${paths.htmlPath}`);

if (summary.failed > 0) {
  process.exit(1);
}
