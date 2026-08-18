import {
  buildLowConfidenceRepeatResponseInstructions,
  buildNextQuestionResponseInstructions,
  buildPostIntroductionResponseInstructions,
  buildSilenceCheckInResponseInstructions,
  isSubstantiveCandidateTranscript,
  type InterviewTurnPhase,
} from "./interview-prompt";

/** Lifecycle of the interview session (maps to legacy opening | intro | questions). */
export type SessionPhase = "opening" | "intro" | "questions" | "closing";

/** Turn-taking phase within the current question cycle. */
export type TurnPhase =
  | "idle"
  | "awaiting_answer"
  | "candidate_speaking"
  | "evaluating"
  | "awaiting_interviewer";

/** Whether the candidate's latest utterance counts as a completed answer. */
export type EvaluationStatus =
  | "pending"
  | "substantive"
  | "empty"
  | "low_confidence"
  | "repeat_requested"
  | "interrupted";

export type QuestionSource =
  | "opening"
  | "intro"
  | "skill"
  | "predefined"
  | "follow_up"
  | "practice"
  | "custom";

export interface TrackedQuestion {
  id: string;
  text: string;
  source: QuestionSource;
  /** Index into the predefined question list when source is predefined. */
  predefinedIndex?: number;
  /** Parent question id when source is follow_up. */
  parentQuestionId?: string;
}

export interface FollowUpRecord {
  question: TrackedQuestion;
  answer: string | null;
  evaluationStatus: EvaluationStatus;
}

export interface AnsweredQuestionRecord {
  question: TrackedQuestion;
  answer: string;
  evaluationStatus: Exclude<EvaluationStatus, "pending" | "interrupted">;
  followUps: FollowUpRecord[];
}

export interface ConversationStateSnapshot {
  sessionPhase: SessionPhase;
  turnPhase: TurnPhase;
  currentQuestion: TrackedQuestion | null;
  currentAnswerText: string | null;
  currentEvaluationStatus: EvaluationStatus;
  /** True while waiting on a follow-up answer for the current topic. */
  awaitingFollowUpAnswer: boolean;
  previousQuestions: AnsweredQuestionRecord[];
  repeatExplicitlyRequested: boolean;
  /** Low-confidence ASR retries used for the current question (reset on new question). */
  transcriptRetryCount: number;
  lastInterviewerUtterance: string | null;
  nextPredefinedIndex: number;
  assessedSkillCount: number;
  version: 1;
}

export type ConversationTransitionEvent =
  | "session_opening_complete"
  | "interviewer_asked_question"
  | "candidate_speech_started"
  | "candidate_speech_stopped"
  | "transcript_evaluated"
  | "interviewer_response_scheduled"
  | "answer_archived"
  | "repeat_request_detected"
  | "interruption"
  | "visibility_resume"
  | "session_closing"
  | "state_restored"
  | "state_rehydrated";

export type ConversationManagerConfig = {
  sessionType: "COMPANY" | "PRACTICE";
  keySkills: string[];
  predefinedQuestions: string[];
  /** When true, logs every state transition to the console. */
  logTransitions?: boolean;
};

const REPEAT_REQUEST_PATTERNS = [
  /\bcan you repeat\b/i,
  /\brepeat (the |that )?question\b/i,
  /\bsay that again\b/i,
  /\bdidn'?t (hear|catch)\b/i,
  /\bcome again\b/i,
  /\bpardon\b/i,
  /\bwhat was the question\b/i,
  /\bcould you (say|repeat)\b/i,
  /\bplease repeat\b/i,
];

const REPEAT_LANGUAGE_PATTERNS: { pattern: RegExp; language: string }[] = [
  { pattern: /\b(in|into)\s+hindi\b/i, language: "Hindi" },
  { pattern: /\bhindi\s+me(in)?\b/i, language: "Hindi" },
  { pattern: /\bhindi\s+mein\b/i, language: "Hindi" },
  { pattern: /\p{Script=Devanagari}+/u, language: "Hindi" },
];

let questionIdCounter = 0;

function nextQuestionId(): string {
  questionIdCounter += 1;
  return `q_${questionIdCounter}`;
}

/** Detect when the candidate explicitly asks to hear the question again. */
export function detectRepeatRequest(transcript: string | null | undefined): boolean {
  if (!transcript) return false;
  const trimmed = transcript.trim();
  if (!trimmed) return false;
  return REPEAT_REQUEST_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** When a repeat request names a language, return it (e.g. Hindi). */
export function detectRepeatLanguageRequest(transcript: string | null | undefined): string | null {
  if (!transcript || !detectRepeatRequest(transcript)) return null;
  const trimmed = transcript.trim();
  for (const { pattern, language } of REPEAT_LANGUAGE_PATTERNS) {
    if (pattern.test(trimmed)) return language;
  }
  return null;
}

/** Heuristic: does interviewer text contain an actual question (not just acknowledgement)? */
export function interviewerTextContainsQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 12) return false;
  const lower = trimmed.toLowerCase();
  if (
    /^(got it|understood|thanks|thank you|great|good approach|that makes sense|perfect|wonderful)[.!,]?\s*$/i.test(
      lower,
    )
  ) {
    return false;
  }
  if (trimmed.includes("?")) return true;
  return /\b(can you|could you|would you|tell me|describe|walk me through|how do|how did|how would|what is|what are|explain)\b/i.test(
    trimmed,
  );
}

function classifyEvaluation(transcript: string | null | undefined): EvaluationStatus {
  if (detectRepeatRequest(transcript)) return "repeat_requested";
  if (!isSubstantiveCandidateTranscript(transcript)) return "empty";
  return "substantive";
}

function createSnapshot(state: ConversationStateSnapshot): ConversationStateSnapshot {
  return structuredClone(state);
}

/**
 * Finite-state conversation manager for AI interview turn-taking.
 *
 * Tracks current/previous questions, candidate answers, evaluation status,
 * follow-ups, and gates advancement until a substantive answer is received.
 */
export class InterviewConversationManager {
  private state: ConversationStateSnapshot;
  private readonly config: ConversationManagerConfig;
  /** Precomputed per-turn instructions — invalidated on state change. */
  private cachedResponseInstructions: string | null = null;
  private cachedInstructionsKey: string | null = null;

  constructor(config: ConversationManagerConfig, initial?: Partial<ConversationStateSnapshot>) {
    this.config = config;
    this.state = {
      sessionPhase: "opening",
      turnPhase: "idle",
      currentQuestion: null,
      currentAnswerText: null,
      currentEvaluationStatus: "pending",
      awaitingFollowUpAnswer: false,
      previousQuestions: [],
      repeatExplicitlyRequested: false,
      transcriptRetryCount: 0,
      lastInterviewerUtterance: null,
      nextPredefinedIndex: 0,
      assessedSkillCount: 0,
      version: 1,
      ...initial,
    };
  }

  get snapshot(): ConversationStateSnapshot {
    return createSnapshot(this.state);
  }

  /** Legacy phase used by existing prompt builders. */
  get interviewPhase(): InterviewTurnPhase {
    if (this.state.sessionPhase === "opening") return "opening";
    if (this.state.sessionPhase === "intro") return "intro";
    return "questions";
  }

  /** Whether the FSM allows scheduling a next-question response. */
  canAdvanceToNextQuestion(): boolean {
    return (
      this.state.currentEvaluationStatus === "substantive" &&
      !this.state.repeatExplicitlyRequested &&
      !this.state.awaitingFollowUpAnswer
    );
  }

  /** Replace the configured predefined question agenda (e.g. after realtime token fetch). */
  setPredefinedQuestions(questions: string[]): void {
    this.config.predefinedQuestions = questions;
    this.cachedResponseInstructions = null;
    this.cachedInstructionsKey = null;
  }

  /** Whether a response should be scheduled after the candidate stops speaking. */
  shouldScheduleResponseAfterCandidate(): boolean {
    return this.state.sessionPhase !== "opening";
  }

  private logTransition(
    event: ConversationTransitionEvent,
    from: Partial<ConversationStateSnapshot>,
    to: Partial<ConversationStateSnapshot>,
  ): void {
    if (!this.config.logTransitions) return;
    console.log("[InterviewConversationFSM]", {
      event,
      from: { sessionPhase: from.sessionPhase, turnPhase: from.turnPhase, evaluation: from.currentEvaluationStatus },
      to: { sessionPhase: to.sessionPhase, turnPhase: to.turnPhase, evaluation: to.currentEvaluationStatus },
      currentQuestion: to.currentQuestion?.text?.slice(0, 80) ?? this.state.currentQuestion?.text?.slice(0, 80),
    });
  }

  private transition(
    event: ConversationTransitionEvent,
    patch: Partial<ConversationStateSnapshot>,
  ): void {
    const from = createSnapshot(this.state);
    Object.assign(this.state, patch);
    this.invalidateInstructionCache();
    this.logTransition(event, from, this.state);
  }

  /** Called when the opening greeting finishes (interviewer asked for self-intro). */
  onOpeningComplete(interviewerText: string): void {
    const introQuestion: TrackedQuestion = {
      id: nextQuestionId(),
      text: interviewerText.trim(),
      source: "intro",
    };
    this.transition("session_opening_complete", {
      sessionPhase: "intro",
      turnPhase: "awaiting_answer",
      currentQuestion: introQuestion,
      currentAnswerText: null,
      currentEvaluationStatus: "pending",
      repeatExplicitlyRequested: false,
      transcriptRetryCount: 0,
      lastInterviewerUtterance: interviewerText.trim(),
    });
  }

  /** Record interviewer speech and update the tracked current question when appropriate. */
  /**
   * Resume after a camera/mic/visibility pause — keep the current question and
   * predefined index; only reset turn-taking so the candidate can answer again.
   */
  onVisibilityResumeUtterance(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    this.transition("visibility_resume", {
      turnPhase: "awaiting_answer",
      lastInterviewerUtterance: trimmed,
      currentEvaluationStatus: "pending",
      repeatExplicitlyRequested: false,
    });
  }

  onInterviewerUtterance(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;

    this.state.lastInterviewerUtterance = trimmed;

    if (this.state.sessionPhase === "opening" && interviewerTextContainsQuestion(trimmed)) {
      this.onOpeningComplete(trimmed);
      return;
    }

    if (!interviewerTextContainsQuestion(trimmed)) {
      this.transition("interviewer_asked_question", {
        turnPhase: "awaiting_answer",
        lastInterviewerUtterance: trimmed,
      });
      return;
    }

    const tracked = this.resolveTrackedQuestion(trimmed);

    // Archive a completed substantive answer before advancing to a new question.
    if (
      this.state.currentQuestion &&
      this.state.currentEvaluationStatus === "substantive" &&
      this.state.currentAnswerText
    ) {
      this.archiveCurrentAnswer();
    }

    this.transition("interviewer_asked_question", {
      turnPhase: "awaiting_answer",
      currentQuestion: tracked,
      currentAnswerText: null,
      currentEvaluationStatus: "pending",
      awaitingFollowUpAnswer: tracked.source === "follow_up",
      repeatExplicitlyRequested: false,
      transcriptRetryCount: 0,
      lastInterviewerUtterance: trimmed,
    });

    if (tracked.source === "predefined" && tracked.predefinedIndex != null) {
      this.state.nextPredefinedIndex = Math.max(
        this.state.nextPredefinedIndex,
        tracked.predefinedIndex + 1,
      );
    }
  }

  /** Mark that the interviewer asked a same-topic follow-up (answer was incomplete). */
  onFollowUpQuestionAsked(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || !this.state.currentQuestion) return;
    this.transition("interviewer_asked_question", {
      turnPhase: "awaiting_answer",
      currentQuestion: {
        id: nextQuestionId(),
        text: trimmed,
        source: "follow_up",
        parentQuestionId: this.state.currentQuestion.id,
      },
      currentAnswerText: null,
      currentEvaluationStatus: "pending",
      awaitingFollowUpAnswer: true,
      repeatExplicitlyRequested: false,
      transcriptRetryCount: 0,
      lastInterviewerUtterance: trimmed,
    });
  }

  private resolveTrackedQuestion(text: string): TrackedQuestion {
    const normalized = text.toLowerCase();

    for (let i = this.state.nextPredefinedIndex; i < this.config.predefinedQuestions.length; i++) {
      const predefined = this.config.predefinedQuestions[i];
      const probe = predefined.toLowerCase().slice(0, 40);
      if (normalized.includes(probe) || probe.includes(normalized.slice(0, 40))) {
        return { id: nextQuestionId(), text: predefined, source: "predefined", predefinedIndex: i };
      }
    }

    if (this.config.sessionType === "PRACTICE") {
      return { id: nextQuestionId(), text: text.trim(), source: "practice" };
    }

    const skillIndex = this.state.assessedSkillCount;
    if (skillIndex < this.config.keySkills.length) {
      return {
        id: nextQuestionId(),
        text: text.trim(),
        source: "skill",
      };
    }

    return { id: nextQuestionId(), text: text.trim(), source: "custom" };
  }

  onCandidateSpeechStarted(): void {
    if (this.state.turnPhase === "evaluating") {
      this.transition("interruption", {
        turnPhase: "candidate_speaking",
        currentEvaluationStatus: "interrupted",
      });
      return;
    }
    this.transition("candidate_speech_started", {
      turnPhase: "candidate_speaking",
      currentEvaluationStatus: "pending",
      repeatExplicitlyRequested: false,
    });
  }

  onCandidateSpeechStopped(): void {
    this.transition("candidate_speech_stopped", {
      turnPhase: "evaluating",
    });
  }

  /** Evaluate Whisper transcript and update answer state. Returns evaluation status. */
  onTranscriptReceived(transcript: string | null | undefined): EvaluationStatus {
    const evaluation = classifyEvaluation(transcript);
    const trimmed = transcript?.trim() ?? "";

    if (evaluation === "repeat_requested") {
      this.transition("repeat_request_detected", {
        currentAnswerText: trimmed,
        currentEvaluationStatus: "repeat_requested",
        repeatExplicitlyRequested: true,
        turnPhase: "evaluating",
      });
      return evaluation;
    }

    this.transition("transcript_evaluated", {
      currentAnswerText: trimmed || null,
      currentEvaluationStatus: evaluation,
      repeatExplicitlyRequested: false,
      transcriptRetryCount: evaluation === "substantive" ? 0 : this.state.transcriptRetryCount,
      turnPhase: "evaluating",
    });

    return evaluation;
  }

  /**
   * ASR produced text but confidence was below threshold — do not evaluate or archive.
   * Increments the per-question retry counter for automatic re-transcription attempts.
   */
  onTranscriptLowConfidence(): EvaluationStatus {
    const nextRetryCount = this.state.transcriptRetryCount + 1;
    this.transition("transcript_evaluated", {
      currentAnswerText: null,
      currentEvaluationStatus: "low_confidence",
      repeatExplicitlyRequested: false,
      transcriptRetryCount: nextRetryCount,
      turnPhase: "evaluating",
    });
    return "low_confidence";
  }

  private invalidateInstructionCache(): void {
    this.cachedResponseInstructions = null;
    this.cachedInstructionsKey = null;
  }

  /** Whether the next turn should include an explicit predefined-question hint. */
  shouldIncludeNextPredefinedHint(): boolean {
    if (this.state.sessionPhase !== "questions") return false;
    if (this.config.predefinedQuestions.length > 0) return true;
    if (this.config.keySkills.length === 0) return true;
    return this.state.assessedSkillCount >= this.config.keySkills.length;
  }

  /** Next predefined question text for preloading into per-turn instructions. */
  getNextPredefinedQuestionText(): string | null {
    const index = this.state.nextPredefinedIndex;
    if (index < 0 || index >= this.config.predefinedQuestions.length) return null;
    return this.config.predefinedQuestions[index]?.trim() || null;
  }

  private buildInstructionsKey(transcript: string | null | undefined): string {
    return [
      this.state.sessionPhase,
      this.state.currentEvaluationStatus,
      this.state.repeatExplicitlyRequested ? "1" : "0",
      String(this.state.transcriptRetryCount),
      this.state.awaitingFollowUpAnswer ? "1" : "0",
      this.state.nextPredefinedIndex,
      transcript?.trim() ?? "",
    ].join("|");
  }

  private computeResponseInstructions(transcript: string | null | undefined): string | null {
    if (this.state.sessionPhase === "opening") return null;

    if (this.state.repeatExplicitlyRequested || detectRepeatRequest(transcript)) {
      return buildRepeatQuestionResponseInstructions(
        this.state.currentQuestion?.text,
        detectRepeatLanguageRequest(transcript),
      );
    }

    if (this.state.currentEvaluationStatus === "low_confidence") {
      return buildLowConfidenceRepeatResponseInstructions(this.state.transcriptRetryCount);
    }

    if (!isSubstantiveCandidateTranscript(transcript)) {
      return buildSilenceCheckInResponseInstructions();
    }

    if (!this.canAdvanceToNextQuestion()) {
      return buildSilenceCheckInResponseInstructions();
    }

    const nextQuestionText =
      this.shouldIncludeNextPredefinedHint() ? this.getNextPredefinedQuestionText() : null;
    const sharedInput = {
      sessionType: this.config.sessionType,
      keySkills: this.config.keySkills,
      hasPredefinedQuestions: this.config.predefinedQuestions.length > 0,
      nextQuestionText,
    };

    if (this.state.sessionPhase === "intro") {
      return buildPostIntroductionResponseInstructions(sharedInput);
    }

    return buildNextQuestionResponseInstructions(sharedInput);
  }

  /**
   * Preload per-turn instructions as soon as the transcript is known —
   * avoids rebuilding on the critical path to response.create.
   */
  preloadResponseInstructions(transcript: string | null | undefined): string | null {
    const key = this.buildInstructionsKey(transcript);
    if (this.cachedInstructionsKey === key && this.cachedResponseInstructions) {
      return this.cachedResponseInstructions;
    }
    const instructions = this.computeResponseInstructions(transcript);
    this.cachedInstructionsKey = key;
    this.cachedResponseInstructions = instructions;
    return instructions;
  }

  /** Build per-turn instructions for response.create based on FSM state. */
  getResponseInstructions(): string | null {
    if (this.cachedResponseInstructions && this.cachedInstructionsKey === this.buildInstructionsKey(this.state.currentAnswerText)) {
      return this.cachedResponseInstructions;
    }
    return this.preloadResponseInstructions(this.state.currentAnswerText);
  }

  onInterviewerResponseScheduled(): void {
    const patch: Partial<ConversationStateSnapshot> = {
      turnPhase: "awaiting_interviewer",
    };
    if (this.state.sessionPhase === "intro" &&
      this.state.currentEvaluationStatus === "substantive"
    ) {
      patch.sessionPhase = "questions";
    }
    this.transition("interviewer_response_scheduled", patch);
  }

  onInterviewerResponseComplete(): void {
    this.transition("interviewer_response_scheduled", {
      turnPhase: "awaiting_answer",
    });
  }

  onSessionClosing(): void {
    this.transition("session_closing", { sessionPhase: "closing", turnPhase: "idle" });
  }

  /** Restore from sessionStorage snapshot after reconnect. */
  restore(snapshot: ConversationStateSnapshot): void {
    this.state = createSnapshot(snapshot);
    this.transition("state_restored", {});
  }

  /** Fallback: rebuild minimal state from persisted transcript turns. */
  rehydrateFromTranscript(
    turns: Array<{ speaker: "interviewer" | "candidate"; text: string }>,
  ): void {
    for (const turn of turns) {
      if (turn.speaker === "interviewer") {
        this.onInterviewerUtterance(turn.text);
      } else {
        this.onCandidateSpeechStarted();
        this.onCandidateSpeechStopped();
        this.onTranscriptReceived(turn.text);
      }
    }
    this.transition("state_rehydrated", {});
  }

  serialize(): ConversationStateSnapshot {
    return this.snapshot;
  }

  /**
   * True when the configured interview agenda (mandatory questions or key skills)
   * has been fully covered and the session is in the main questioning phase.
   */
  areAllPlannedQuestionsComplete(): boolean {
    if (this.state.sessionPhase === "opening" || this.state.sessionPhase === "intro") {
      return false;
    }

    const predefined = this.config.predefinedQuestions;
    if (predefined.length > 0) {
      return this.state.nextPredefinedIndex >= predefined.length;
    }

    if (this.config.keySkills.length > 0) {
      return this.state.assessedSkillCount >= this.config.keySkills.length;
    }

    return this.state.sessionPhase === "questions";
  }

  private archiveCurrentAnswer(): void {
    if (!this.state.currentQuestion || !this.state.currentAnswerText) return;

    if (this.state.awaitingFollowUpAnswer && this.state.previousQuestions.length > 0) {
      const parent = this.state.previousQuestions[this.state.previousQuestions.length - 1];
      parent.followUps = [
        ...parent.followUps,
        {
          question: this.state.currentQuestion,
          answer: this.state.currentAnswerText,
          evaluationStatus:
            this.state.currentEvaluationStatus === "substantive" ? "substantive" : "empty",
        },
      ];
      this.state.previousQuestions = [...this.state.previousQuestions.slice(0, -1), parent];
    } else {
      const record: AnsweredQuestionRecord = {
        question: this.state.currentQuestion,
        answer: this.state.currentAnswerText,
        evaluationStatus:
          this.state.currentEvaluationStatus === "substantive" ? "substantive" : "empty",
        followUps: [],
      };
      this.state.previousQuestions = [...this.state.previousQuestions, record];
    }

    if (
      this.state.currentQuestion?.source === "skill" &&
      !this.state.awaitingFollowUpAnswer
    ) {
      this.state.assessedSkillCount = Math.min(
        this.state.assessedSkillCount + 1,
        this.config.keySkills.length,
      );
    }

    this.transition("answer_archived", {
      awaitingFollowUpAnswer: false,
    });
  }
}

/** Injected when the candidate explicitly asks to repeat the question. */
export function buildRepeatQuestionResponseInstructions(
  currentQuestionText?: string | null,
  requestedLanguage?: string | null,
): string {
  const trimmedQuestion = currentQuestionText?.trim();
  const questionHint = trimmedQuestion
    ? `Repeat this question clearly: "${trimmedQuestion}"`
    : "Repeat your last question clearly";
  const language = requestedLanguage?.trim();

  if (language) {
    return [
      `The candidate asked you to repeat the question in ${language}.`,
      "Do NOT advance to a new question.",
      "Do NOT say 'Got it' or give acknowledgement — they have not answered yet.",
      `Translate and repeat the same question in ${language}. Keep the meaning identical to the original English question.`,
      trimmedQuestion ? `Original question: "${trimmedQuestion}"` : questionHint,
      `After repeating in ${language}, wait for their answer. Continue the rest of the interview in English.`,
      "Keep it calm and brief.",
    ].join(" ");
  }

  return [
    "The candidate asked you to repeat the question or indicated they did not hear it.",
    "Do NOT advance to a new question.",
    "Do NOT say 'Got it' or give acknowledgement — they have not answered yet.",
    questionHint,
    "Keep it calm and brief.",
  ].join(" ");
}

/** Detect interviewer farewell / closing sign-off (not mid-interview acknowledgements). */
export function isInterviewerClosingRemark(text: string): boolean {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return false;

  const closeSignals = [
    "interview is over",
    "this interview is over",
    "that concludes the interview",
    "we can conclude this interview",
    "this concludes our interview",
    "concludes our interview",
    "conclude our interview",
    "we have come to the end of the interview",
    "we are at the end of this interview",
    "end of the interview",
    "end of our interview",
    "that wraps up",
    "wraps up our interview",
    "thank you for your time today",
    "thank you for your time",
    "thanks for your time today",
    "thanks for your time",
    "best of luck",
    "good luck with",
    "wishing you all the best",
    "all the best",
    "goodbye",
    "good bye",
    "bye for now",
    "have a great day",
    "have a good day",
    "take care",
    "we're done here",
    "we are done here",
  ];

  return closeSignals.some((signal) => normalized.includes(signal));
}
