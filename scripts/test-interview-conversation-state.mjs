/**
 * Tests for the interview conversation finite state machine.
 * Run: node scripts/test-interview-conversation-state.mjs
 */
import assert from "node:assert/strict";
import {
  InterviewConversationManager,
  detectRepeatRequest,
  detectRepeatLanguageRequest,
  interviewerTextContainsQuestion,
  isInterviewerClosingRemark,
  buildRepeatQuestionResponseInstructions,
} from "../src/lib/interview-conversation-state.ts";
import {
  buildLowConfidenceRepeatResponseInstructions,
  buildNextQuestionResponseInstructions,
  buildPostIntroductionResponseInstructions,
  buildSilenceCheckInResponseInstructions,
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

function createManager(overrides = {}) {
  return new InterviewConversationManager({
    sessionType: "COMPANY",
    keySkills: ["React"],
    predefinedQuestions: ["How do you handle production incidents?"],
    logTransitions: false,
    ...overrides,
  });
}

console.log("Interview conversation state FSM tests\n");

test("detects explicit repeat requests", () => {
  assert.equal(detectRepeatRequest("Can you repeat the question?"), true);
  assert.equal(detectRepeatRequest("I didn't catch that."), true);
  assert.equal(detectRepeatRequest("I led the migration."), false);
});

test("detects language-specific repeat requests", () => {
  assert.equal(detectRepeatLanguageRequest("Sorry, can you repeat the question in Hindi?"), "Hindi");
  assert.equal(detectRepeatLanguageRequest("Can you repeat the question?"), null);
  assert.equal(detectRepeatLanguageRequest("I led the migration."), null);
});

test("blocks scheduling during opening phase", () => {
  const manager = createManager();
  assert.equal(manager.shouldScheduleResponseAfterCandidate(), false);
  assert.equal(manager.getResponseInstructions(), null);
});

test("opening complete transitions to intro and tracks current question", () => {
  const manager = createManager();
  const opening =
    "Hi Alex, I am Jordan. Please introduce yourself and your background.";
  manager.onOpeningComplete(opening);
  assert.equal(manager.interviewPhase, "intro");
  assert.equal(manager.snapshot.currentQuestion?.source, "intro");
  assert.equal(manager.snapshot.turnPhase, "awaiting_answer");
});

test("empty transcript never advances to next question", () => {
  const manager = createManager();
  manager.onOpeningComplete("Please introduce yourself.");
  manager.onCandidateSpeechStarted();
  manager.onCandidateSpeechStopped();
  manager.onTranscriptReceived("");
  assert.equal(manager.snapshot.currentEvaluationStatus, "empty");
  assert.equal(manager.canAdvanceToNextQuestion(), false);
  assert.equal(manager.getResponseInstructions(), buildSilenceCheckInResponseInstructions());
});

test("low-confidence transcript does not advance and asks to repeat the answer", () => {
  const manager = createManager();
  manager.onOpeningComplete("Please introduce yourself.");
  manager.onCandidateSpeechStarted();
  manager.onCandidateSpeechStopped();
  manager.onTranscriptLowConfidence();
  assert.equal(manager.snapshot.currentEvaluationStatus, "low_confidence");
  assert.equal(manager.canAdvanceToNextQuestion(), false);
  assert.equal(
    manager.getResponseInstructions(),
    buildLowConfidenceRepeatResponseInstructions(1),
  );
});

test("substantive intro answer yields post-intro instructions before questions phase", () => {
  const manager = createManager();
  manager.onOpeningComplete("Please introduce yourself.");
  manager.onCandidateSpeechStarted();
  manager.onCandidateSpeechStopped();
  manager.onTranscriptReceived("I am a senior React engineer with eight years of experience.");
  assert.equal(manager.interviewPhase, "intro");
  const introInstructions = manager.getResponseInstructions();
  assert.ok(introInstructions);
  assert.match(introInstructions, /FIRST predefined interview question/i);
  manager.onInterviewerResponseScheduled();
  assert.equal(manager.interviewPhase, "questions");
});

test("repeat request keeps same question and uses repeat instructions", () => {
  const manager = createManager();
  manager.onOpeningComplete("What is your experience with React?");
  manager.onCandidateSpeechStarted();
  manager.onCandidateSpeechStopped();
  manager.onTranscriptReceived("Sorry, can you repeat the question?");
  assert.equal(manager.snapshot.repeatExplicitlyRequested, true);
  assert.equal(manager.canAdvanceToNextQuestion(), false);
  assert.match(
    manager.getResponseInstructions(),
    /Do NOT advance to a new question/i,
  );
  assert.equal(
    manager.getResponseInstructions(),
    buildRepeatQuestionResponseInstructions("What is your experience with React?"),
  );
});

test("repeat request in Hindi uses translated repeat instructions", () => {
  const manager = createManager();
  manager.onOpeningComplete("How do you build responsive web apps with React?");
  manager.onCandidateSpeechStarted();
  manager.onCandidateSpeechStopped();
  manager.onTranscriptReceived("Sorry, can you repeat the question in Hindi?");
  assert.equal(manager.snapshot.repeatExplicitlyRequested, true);
  const instructions = manager.getResponseInstructions();
  assert.match(instructions, /repeat the question in Hindi/i);
  assert.match(instructions, /Translate and repeat the same question in Hindi/i);
  assert.match(instructions, /How do you build responsive web apps with React/);
});

test("substantive answer after intro advances with next-question instructions", () => {
  const manager = createManager();
  manager.onOpeningComplete("Please introduce yourself.");
  manager.onTranscriptReceived("I have five years of React experience.");
  manager.onInterviewerResponseScheduled();
  manager.onInterviewerUtterance("How many years have you worked with React in production?");
  manager.onCandidateSpeechStarted();
  manager.onCandidateSpeechStopped();
  manager.onTranscriptReceived("About five years across two companies.");
  assert.equal(manager.snapshot.currentEvaluationStatus, "substantive");
  const nextInstructions = manager.getResponseInstructions();
  assert.ok(nextInstructions);
  assert.match(nextInstructions, /NEXT question from your predefined interview question list/i);
  assert.match(nextInstructions, /How do you handle production incidents/);
});

test("interruption marks evaluation as interrupted then re-evaluates", () => {
  const manager = createManager();
  manager.onOpeningComplete("Tell me about yourself.");
  manager.onCandidateSpeechStopped();
  manager.onCandidateSpeechStarted();
  assert.equal(manager.snapshot.currentEvaluationStatus, "interrupted");
});

test("serializes and restores conversation state for reconnect", () => {
  const manager = createManager();
  manager.onOpeningComplete("Please introduce yourself.");
  manager.onTranscriptReceived("I am a backend engineer.");
  manager.onInterviewerResponseScheduled();
  const saved = manager.serialize();

  const restored = createManager();
  restored.restore(saved);
  assert.equal(restored.interviewPhase, "questions");
  assert.equal(restored.snapshot.currentEvaluationStatus, "substantive");
  assert.equal(restored.snapshot.previousQuestions.length, 0);
});

test("interviewer acknowledgements without questions are not treated as new questions", () => {
  assert.equal(interviewerTextContainsQuestion("Got it."), false);
  assert.equal(interviewerTextContainsQuestion("Thanks for sharing."), false);
  assert.equal(interviewerTextContainsQuestion("Can you walk me through your last project?"), true);
});

test("visibility resume utterance keeps the current question and predefined index", () => {
  const manager = createManager({
    predefinedQuestions: ["How do you handle production incidents?", "Describe your testing strategy."],
  });
  manager.onOpeningComplete("Please introduce yourself.");
  manager.onTranscriptReceived("I am a senior React engineer with eight years of experience.");
  manager.onInterviewerResponseScheduled();
  manager.onInterviewerUtterance("How do you handle production incidents?");
  const questionBefore = manager.snapshot.currentQuestion?.text;
  const indexBefore = manager.snapshot.nextPredefinedIndex;

  manager.onVisibilityResumeUtterance(
    "Welcome back. How do you handle production incidents?",
  );

  assert.equal(manager.snapshot.currentQuestion?.text, questionBefore);
  assert.equal(manager.snapshot.nextPredefinedIndex, indexBefore);
  assert.equal(manager.snapshot.turnPhase, "awaiting_answer");
  assert.equal(manager.snapshot.currentEvaluationStatus, "pending");
});

test("detects interviewer closing remarks including goodbye and best of luck", () => {
  assert.equal(
    isInterviewerClosingRemark(
      "Thank you for your time today. This concludes our interview. Best of luck!",
    ),
    true,
  );
  assert.equal(isInterviewerClosingRemark("Goodbye, and have a great day."), true);
  assert.equal(isInterviewerClosingRemark("Can you walk me through your last project?"), false);
});

test("areAllPlannedQuestionsComplete after mandatory agenda is asked", () => {
  const manager = createManager({
    predefinedQuestions: ["How do you handle production incidents?", "Describe your testing strategy."],
  });
  manager.onOpeningComplete("Please introduce yourself.");
  manager.onTranscriptReceived("I am a senior React engineer.");
  manager.onInterviewerResponseScheduled();
  manager.onInterviewerUtterance("How do you handle production incidents?");
  manager.onTranscriptReceived("I triage alerts and roll back if needed.");
  manager.onInterviewerResponseScheduled();
  manager.onInterviewerUtterance("Describe your testing strategy.");
  assert.equal(manager.areAllPlannedQuestionsComplete(), true);
});

test("areAllPlannedQuestionsComplete false while mandatory questions remain", () => {
  const manager = createManager({
    predefinedQuestions: ["How do you handle production incidents?", "Describe your testing strategy."],
  });
  manager.onOpeningComplete("Please introduce yourself.");
  manager.onTranscriptReceived("I am a senior React engineer.");
  manager.onInterviewerResponseScheduled();
  manager.onInterviewerUtterance("How do you handle production incidents?");
  assert.equal(manager.areAllPlannedQuestionsComplete(), false);
});

console.log("\nAll conversation state FSM tests passed.");
