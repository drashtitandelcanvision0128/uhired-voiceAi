"use client";

import {
  Bell,
  Captions,
  LoaderCircle,
  Mic,
  MicOff,
  PhoneOff,
  Settings,
  Signal,
  User,
  Video,
  VideoOff,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from "react";
import { INTERVIEW_CONSENT_SUMMARY } from "@/lib/interview-consent";
import {
  InterviewConversationManager,
  isInterviewerClosingRemark,
  type ConversationStateSnapshot,
} from "@/lib/interview-conversation-state";
import {
  buildCompanyRealtimeInstructions,
  buildOpeningGreetingResponseInstructions,
  buildPracticeRealtimeInstructions,
  buildResumeAfterPauseResponseInstructions,
  buildSilenceCheckInResponseInstructions,
  INTERVIEW_TURN_TIMING,
  isSubstantiveCandidateTranscript,
} from "@/lib/interview-prompt";
import { expandKeySkills } from "@/lib/key-skill-expansion";
import { InterviewTurnPerformanceTracker } from "@/lib/interview-turn-performance";
import {
  resolveInterviewerPanelLabel,
  resolveRealtimeVoice,
  type RealtimeBuiltinVoice,
} from "@/lib/interviewer-profile";
import type { InterviewerVoiceGender } from "@prisma/client";
import {
  buildRealtimeSessionConfig,
  resolveRealtimeResponseMode,
} from "@/lib/realtime-session";
import type { VoiceTtsProvider } from "@/lib/voice-tts";
import {
  processCandidateTranscript,
  type TranscriptLogProb,
} from "@/lib/speech-transcription";
import {
  computeRemainingSec,
  resolveDisplayedRemainingSec,
  shouldRestoreInterviewTimer,
} from "@/lib/interview-timer";
import { buildTranscriptPayload, sortTranscriptTurns } from "@/lib/transcript-order";
import {
  logTranscriptConfidence,
  validateTranscriptConfidence,
} from "@/lib/transcript-confidence-validation";
import {
  evaluateCandidateVisibility,
  preloadFaceDetector,
} from "@/lib/candidate-face-detection";
import {
  deriveInterviewLivePhase,
  formatLivePhaseStatus,
  type InterviewLivePhase,
} from "@/lib/interview-live-phase";
import {
  deriveInterviewStatusVisual,
  formatInterviewPauseStatus,
  getInterviewPauseOverlay,
  type InterviewPauseReason,
} from "@/lib/interview-room-display";
import { ClientVadAnalyzer } from "@/lib/client-vad-analyzer";
import {
  buildServerVadTurnDetection,
  computeDynamicSilenceDurationMs,
  isShortKeyboardUtterance,
  resolveVadConfig,
  type SpeechStartValidation,
} from "@/lib/voice-activity-detection";

type TranscriptTurn = {
  id: string;
  speaker: "interviewer" | "candidate";
  text: string;
  timestampMs: number;
  orderIndex: number;
  /** ASR confidence 0–1 when available. */
  confidence?: number | null;
};

type RealtimeEvent = {
  type: string;
  item_id?: string;
  response_id?: string;
  transcript?: string;
  text?: string;
  delta?: string;
  logprobs?: TranscriptLogProb[];
  error?: { message?: string; code?: string };
  response?: {
    id?: string;
    status?: string;
    status_details?: { error?: { message?: string } };
  };
};

function getRealtimeResponseId(event: RealtimeEvent): string | undefined {
  return event.response_id ?? event.response?.id;
}

const PRACTICE_WRAP_UP_WINDOW_SEC = 15;
const COMPANY_WRAP_UP_WINDOW_SEC = 120;
const PRACTICE_INACTIVITY_NUDGE_SEC = 12;
const COMPANY_INACTIVITY_NUDGE_SEC = 20;
const INACTIVITY_NUDGE_COOLDOWN_SEC = 10;
const STUCK_THINKING_NUDGE_SEC = 15;
const AI_AUDIO_SETTLE_MS = 250;
// Keep these short so the interviewer starts talking quickly once the channel is ready.
const OPENING_GREETING_FALLBACK_MS = 1200;
const OPENING_GREETING_DELAY_MS = 150;
/** Max wait for Whisper before treating an utterance as silent/empty. */
const TRANSCRIPT_TURN_WAIT_MS = INTERVIEW_TURN_TIMING.transcriptTurnWaitMs;
/** Debounce after candidate speech ends — server VAD already detected the turn. */
const CANDIDATE_RESPONSE_DELAY_MS = INTERVIEW_TURN_TIMING.candidateResponseDelayMs;
const REALTIME_TOKEN_CACHE_PREFIX = "realtime_token_";
const REALTIME_TOKEN_EXPIRY_BUFFER_MS = 30_000;

// Camera visibility guard: pause when the candidate's face is not detected or the lens is covered.
const VISIBILITY_SAMPLE_INTERVAL_MS = 700;
/** Consecutive obscured samples before pausing (~2.8s) and clear samples before resuming (~1.4s). */
const VISIBILITY_BLOCK_SAMPLES = 4;
const VISIBILITY_CLEAR_SAMPLES = 2;
/**
 * Max wait for Whisper after speech_stopped (fallback settle) and before finish tears down WebRTC.
 * Turn scheduling still uses speech_stopped — this is for transcript persistence only.
 * Finish uses the same budget so last-turn answers are not dropped when STT lags.
 */
const TRANSCRIPT_FALLBACK_MS = 8_000;
const RESPONSE_RETRY_INTERVAL_MS = 200;
const RESPONSE_MAX_RETRIES = 20;

const EARLY_CLOSE_MIN_ELAPSED_SEC = 180;
const EARLY_CLOSE_MIN_PROGRESS_RATIO = 0.85;

// State persistence for page refresh handling
const STORAGE_KEY_PREFIX = "interview_state_";

interface SavedInterviewState {
  sessionId: string;
  stage: "preflight" | "connecting" | "live" | "ending" | "post" | "error";
  remainingSec: number;
  transcript: TranscriptTurn[];
  timerStartedAt: number | null;
  conversationState?: ConversationStateSnapshot;
  savedAt: number;
}

function getStorageKey(sessionId: string): string {
  return `${STORAGE_KEY_PREFIX}${sessionId}`;
}

function saveInterviewState(sessionId: string, state: SavedInterviewState): void {
  try {
    const key = getStorageKey(sessionId);
    sessionStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    // Silently fail if storage is not available
  }
}

function loadInterviewState(sessionId: string): SavedInterviewState | null {
  try {
    const key = getStorageKey(sessionId);
    const data = sessionStorage.getItem(key);
    if (!data) return null;
    const parsed = JSON.parse(data) as SavedInterviewState;
    // Validate that the saved state matches current session
    if (parsed.sessionId !== sessionId) return null;
    // Don't restore if state is too old (more than 24 hours)
    const ageMs = Date.now() - parsed.savedAt;
    if (ageMs > 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

function clearInterviewState(sessionId: string): void {
  try {
    const key = getStorageKey(sessionId);
    sessionStorage.removeItem(key);
  } catch (e) {
    // Silently fail
  }
}

type CompanyInterviewRoomProps = {
  sessionId: string;
  sessionType: "PRACTICE" | "COMPANY";
  candidateName: string;
  companyName: string | null;
  interviewerName: string | null;
  interviewerDisplayName: string | null;
  interviewerVoiceGender: string | null;
  interviewerVoice: string | null;
  positionTitle: string | null;
  domain: string;
  topic: string;
  jobDescription: string | null;
  keySkills: string[];
  mandatoryQuestions: string[];
  optionalQuestionPool: string[];
  maxOptionalQuestions: number;
  durationSec: number;
  consentAcceptedAt?: string | null;
  brandDisplayName?: string | null;
  brandPrimaryColor?: string | null;
  brandLogoUrl?: string | null;
  brandingCssVars?: Record<string, string>;
};

function formatTranscriptForResume(turns: TranscriptTurn[], maxTurns: number) {
  const slice = sortTranscriptTurns(turns).slice(-maxTurns);
  if (slice.length === 0) return "No transcript captured yet.";
  return slice
    .map((turn, index) => {
      const speaker = turn.speaker === "interviewer" ? "INTERVIEWER" : "CANDIDATE";
      return `${index + 1}. ${speaker}: ${turn.text}`;
    })
    .join("\n");
}

export function CompanyInterviewRoom(props: CompanyInterviewRoomProps) {
  const {
    sessionId,
    sessionType,
    candidateName,
    companyName,
    interviewerName,
    interviewerDisplayName,
    interviewerVoiceGender,
    interviewerVoice,
    positionTitle,
    domain,
    topic,
    jobDescription,
    keySkills,
    mandatoryQuestions,
    optionalQuestionPool,
    maxOptionalQuestions,
    durationSec,
    consentAcceptedAt: initialConsentAcceptedAt,
    brandDisplayName,
    brandPrimaryColor,
    brandLogoUrl,
    brandingCssVars,
  } = props;

  const headerBrandLabel =
    sessionType === "COMPANY"
      ? (brandDisplayName?.trim() || companyName?.trim() || "Uhired")
      : "Uhired";
  const headerBrandColor = sessionType === "COMPANY" ? brandPrimaryColor : null;

  const [consentChecked, setConsentChecked] = useState(Boolean(initialConsentAcceptedAt));
  const shouldRecordVideo = sessionType === "COMPANY";
  const expandedKeySkills = useMemo(() => expandKeySkills(keySkills), [keySkills]);

  const defaultVoiceGender: InterviewerVoiceGender =
    interviewerVoiceGender === "FEMALE" ? "FEMALE" : "MALE";
  const [selectedVoiceGender, setSelectedVoiceGender] =
    useState<InterviewerVoiceGender>(defaultVoiceGender);
  const selectedVoiceGenderRef = useRef<InterviewerVoiceGender>(defaultVoiceGender);
  const voiceTtsProviderRef = useRef<VoiceTtsProvider>("openai");
  const elevenLabsPlaybackUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setSelectedVoiceGender(defaultVoiceGender);
  }, [defaultVoiceGender]);

  useEffect(() => {
    selectedVoiceGenderRef.current = selectedVoiceGender;
  }, [selectedVoiceGender]);

  const realtimeVoice = useMemo(
    () => resolveRealtimeVoice(selectedVoiceGender),
    [selectedVoiceGender],
  );
  const interviewerPanelLabel = useMemo(
    () =>
      resolveInterviewerPanelLabel({
        sessionType,
        interviewerName,
        companyName,
      }),
    [sessionType, interviewerName, companyName],
  );

  const fallbackInstructions = useMemo(
    () =>
      sessionType === "COMPANY"
        ? buildCompanyRealtimeInstructions({
            candidateName,
            companyName,
            interviewerDisplayName,
            positionTitle,
            domain,
            topic,
            jobDescription,
            keySkills: expandedKeySkills,
            mandatoryQuestions,
            optionalQuestions: optionalQuestionPool,
            maxOptionalQuestions,
            durationSec,
          })
        : buildPracticeRealtimeInstructions({
            candidateName,
            domain,
            topic,
            positionTitle: positionTitle || domain,
            mandatoryQuestions,
            durationSec,
          }),
    [
      sessionType,
      candidateName,
      companyName,
      interviewerDisplayName,
      positionTitle,
      domain,
      topic,
      jobDescription,
      expandedKeySkills,
      mandatoryQuestions,
      optionalQuestionPool,
      maxOptionalQuestions,
      durationSec,
    ],
  );
  const serverRealtimeInstructionsRef = useRef<string | null>(null);
  const serverInterviewAgendaRef = useRef<string[]>(mandatoryQuestions);

  const transcriptionContext = useMemo(
    () => ({
      domain,
      topic,
      positionTitle: positionTitle || (sessionType === "PRACTICE" ? domain : null),
      jobDescription,
      keySkills: expandedKeySkills,
      interviewQuestions: mandatoryQuestions,
    }),
    [domain, topic, positionTitle, jobDescription, keySkills, mandatoryQuestions, sessionType],
  );
  const transcriptionContextRef = useRef(transcriptionContext);
  useEffect(() => {
    transcriptionContextRef.current = transcriptionContext;
  }, [transcriptionContext]);

  const [stage, setStage] = useState<
    "preflight" | "connecting" | "live" | "ending" | "post" | "error"
  >("preflight");
  const [error, setError] = useState("");
  const [remainingSec, setRemainingSec] = useState(durationSec);
  const [livePhase, setLivePhase] = useState<InterviewLivePhase>("listening");
  const [showLiveTranscript, setShowLiveTranscript] = useState(false);
  const [liveInterviewerPartial, setLiveInterviewerPartial] = useState("");
  const [permissionReady, setPermissionReady] = useState(false);
  const [isStarting, startTransition] = useTransition();
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [interviewerStarting, setInterviewerStarting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [videoUploadPending, setVideoUploadPending] = useState(false);
  const [visibilityBlocked, setVisibilityBlocked] = useState(false);
  const [pauseReason, setPauseReason] = useState<InterviewPauseReason | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const transcriptRef = useRef<TranscriptTurn[]>([]);
  const [transcriptBump, setTranscriptBump] = useState(0);
  const appendedItemsRef = useRef<Set<string>>(new Set());
  const timerStartedAtRef = useRef<number | null>(null);
  const finishStartedRef = useRef(false);
  /** Interview-clock ms frozen at finish start so late commits/metadata stay aligned. */
  const finishElapsedMsRef = useRef<number | null>(null);
  const cleanupConnectionRef = useRef<() => void>(() => undefined);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const recordingDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const localRecordingSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const remoteRecordingSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const remoteAudioStreamRef = useRef<MediaStream | null>(null);
  const uploadInFlightRef = useRef<Promise<void> | null>(null);
  const completionBeaconSentRef = useRef(false);
  const finishInterviewRef = useRef<
    ((reason: "manual" | "timer" | "disconnect") => Promise<void>) | null
  >(null);
  const practiceWrapUpTriggeredRef = useRef(false);
  const earlyCloseTriggeredRef = useRef(false);
  const lastInterviewerActivityAtRef = useRef(Date.now());
  const lastPracticeNudgeAtRef = useRef(0);
  const stageRef = useRef(stage);
  const reconnectInFlightRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const firstInterviewerResponseStartedRef = useRef(false);
  const candidateSpeechActiveRef = useRef(false);
  const responseInFlightRef = useRef(false);
  const aiAudioActiveRef = useRef(false);
  const aiAudioOffTimerRef = useRef<number | null>(null);
  const candidateUtteranceStartMsRef = useRef<number | null>(null);
  const interviewerResponseStartMsRef = useRef<number | null>(null);
  const interviewerStartMsByItemRef = useRef<Map<string, number>>(new Map());
  const interviewerOrderByItemRef = useRef<Map<string, number>>(new Map());
  const candidatePendingOrderIndexRef = useRef<number | null>(null);
  /** Per realtime user-audio item_id → reserved transcript order (survives later utterances). */
  const candidateOrderByItemRef = useRef<Map<string, number>>(new Map());
  /** Per realtime user-audio item_id → utterance start timestamp. */
  const candidateStartMsByItemRef = useRef<Map<string, number>>(new Map());
  /** Generations that have speech_stopped but not yet transcription.completed/failed/timeout. */
  const unsettledCandidateGensRef = useRef<Set<number>>(new Set());
  const nextTranscriptOrderIndexRef = useRef(0);
  const pendingSessionGreetingRef = useRef<{ resume: boolean } | null>(null);
  const conversationManagerRef = useRef(
    new InterviewConversationManager({
      sessionType,
      keySkills: expandedKeySkills,
      predefinedQuestions:
        serverInterviewAgendaRef.current.length > 0
          ? serverInterviewAgendaRef.current
          : mandatoryQuestions,
      logTransitions: process.env.NODE_ENV === "development",
    }),
  );
  const openingGreetingTimerRef = useRef<number | null>(null);
  const openingInterruptRestoreRef = useRef(false);
  const candidateResponseDelayTimerRef = useRef<number | null>(null);
  const transcriptFallbackTimerRef = useRef<number | null>(null);
  const whisperTurnWaitTimerRef = useRef<number | null>(null);
  /** Per utterance generation → trimmed Whisper text (empty string = no substantive answer). */
  const candidateTranscriptByGenRef = useRef<Map<number, string>>(new Map());
  /** Per utterance generation → speech_stopped timestamp for turn-wait timeout. */
  const speechStoppedAtMsByGenRef = useRef<Map<number, number>>(new Map());
  /** Incremented on each speech_started; gates next-question scheduling after transcription. */
  const candidateUtteranceGenRef = useRef(0);
  /** Generation captured at speech_stopped — must match current gen to schedule a response. */
  const utteranceStoppedGenRef = useRef<number | null>(null);
  /** Generation for which transcription.completed already arrived. */
  const transcriptReceivedGenRef = useRef<number | null>(null);
  /** Maps realtime user-audio item_id → utterance generation. */
  const itemUtteranceGenRef = useRef<Map<string, number>>(new Map());
  /** Accumulated ASR logprobs per item_id (from delta events) for confidence scoring. */
  const logprobsByItemRef = useRef<Map<string, TranscriptLogProb[]>>(new Map());
  /** Prevents duplicate / reset response timers for the same candidate utterance. */
  const scheduledResponseGenRef = useRef<number | null>(null);
  /** Utterance generation for which response.create was already sent. */
  const respondedUtteranceGenRef = useRef<number | null>(null);
  const responseRetryCountRef = useRef(0);
  const turnPerformanceRef = useRef(new InterviewTurnPerformanceTracker());
  const responseCreateGenRef = useRef<number | null>(null);
  // Visibility / pause handling.
  const visibilityBlockedRef = useRef(false);
  const pauseReasonRef = useRef<InterviewPauseReason | null>(null);
  const visibilityResumeResponseRef = useRef(false);
  const visibilityBlockCountRef = useRef(0);
  const visibilityClearCountRef = useRef(0);
  const visibilityEvalInFlightRef = useRef(false);
  const detectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  /** Timestamp when the interview was paused; used to shift the timer start on resume. */
  const pauseStartedAtMsRef = useRef<number | null>(null);
  /** Bumped when the candidate starts the interview so async restore cannot overwrite a fresh start. */
  const interviewStartGenerationRef = useRef(0);
  const vadConfig = useMemo(() => resolveVadConfig(), []);
  const vadAnalyzerRef = useRef<ClientVadAnalyzer | null>(null);
  const vadConfirmTimerRef = useRef<number | null>(null);
  const rejectedVadItemIdsRef = useRef<Set<string>>(new Set());
  const pendingVadSpeechRef = useRef<{
    itemId?: string;
    startedAt: number;
    serverEvent: RealtimeEvent;
  } | null>(null);

  /** Finalize a pause window by shifting the timer start forward by the paused duration. */
  const settlePause = useCallback(() => {
    if (pauseStartedAtMsRef.current === null) return;
    const pausedMs = Date.now() - pauseStartedAtMsRef.current;
    pauseStartedAtMsRef.current = null;
    if (timerStartedAtRef.current !== null) {
      timerStartedAtRef.current += pausedMs;
    }
  }, []);

  const getElapsedMs = useCallback(() => {
    if (finishElapsedMsRef.current != null) {
      return finishElapsedMsRef.current;
    }
    if (!timerStartedAtRef.current) return 0;
    // Freeze during visibility pause (timer start is only shifted on resume).
    const endMs = pauseStartedAtMsRef.current ?? Date.now();
    return Math.max(0, endMs - timerStartedAtRef.current);
  }, []);

  const sendRealtimeEvent = useCallback((event: any) => {
    try {
      // If we're trying to create a response while one is already in-flight,
      // ignore the duplicate to avoid server errors like:
      // "Conversation already has an active response in progress"
      if (event?.type === "response.create") {
        if (responseInFlightRef.current) {
          return false;
        }
        // Mark it as in-flight immediately so subsequent calls are debounced
        responseInFlightRef.current = true;
      }
    } catch {
      // Ignore errors while inspecting the event
    }

    if (channelRef.current?.readyState === "open") {
      channelRef.current.send(JSON.stringify(event));
      return true;
    }
    if (event?.type === "response.create") {
      responseInFlightRef.current = false;
    }
    return false;
  }, []);

  const clearCandidateResponseDelayTimer = useCallback(() => {
    if (candidateResponseDelayTimerRef.current !== null) {
      window.clearTimeout(candidateResponseDelayTimerRef.current);
      candidateResponseDelayTimerRef.current = null;
    }
  }, []);

  const clearTranscriptFallbackTimer = useCallback(() => {
    if (transcriptFallbackTimerRef.current !== null) {
      window.clearTimeout(transcriptFallbackTimerRef.current);
      transcriptFallbackTimerRef.current = null;
    }
  }, []);

  const clearWhisperTurnWaitTimer = useCallback(() => {
    if (whisperTurnWaitTimerRef.current !== null) {
      window.clearTimeout(whisperTurnWaitTimerRef.current);
      whisperTurnWaitTimerRef.current = null;
    }
  }, []);

  const clearVadConfirmTimer = useCallback(() => {
    if (vadConfirmTimerRef.current !== null) {
      window.clearTimeout(vadConfirmTimerRef.current);
      vadConfirmTimerRef.current = null;
    }
  }, []);

  const attachVadAnalyzer = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (!stream) return;
    if (!vadAnalyzerRef.current) {
      vadAnalyzerRef.current = new ClientVadAnalyzer(vadConfig);
    }
    vadAnalyzerRef.current.attach(stream);
  }, [vadConfig]);

  const updateDynamicVadSilence = useCallback(() => {
    const analyzer = vadAnalyzerRef.current;
    const context = analyzer?.getDynamicSilenceContext() ?? {
      utteranceDurationMs: 0,
      midUtterancePauseCount: 0,
      lastUtteranceWasSubstantive: false,
    };
    const silenceMs = computeDynamicSilenceDurationMs(vadConfig, context);
    sendRealtimeEvent({
      type: "session.update",
      session: {
        type: "realtime",
        audio: {
          input: {
            turn_detection: {
              ...buildServerVadTurnDetection(vadConfig, silenceMs),
              create_response: false,
              interrupt_response: false,
            },
          },
        },
      },
    });
  }, [sendRealtimeEvent, vadConfig]);

  const recomputeLivePhase = useCallback(() => {
    setLivePhase(
      deriveInterviewLivePhase({
        aiAudioActive: aiAudioActiveRef.current,
        responseInFlight: responseInFlightRef.current,
        candidateSpeechActive: candidateSpeechActiveRef.current,
        unsettledCandidateUtterances: unsettledCandidateGensRef.current.size,
        responseDelayPending: candidateResponseDelayTimerRef.current !== null,
      }),
    );
  }, []);

  const settleCandidateUtteranceGen = useCallback(
    (gen: number | null | undefined) => {
      if (gen == null) return;
      unsettledCandidateGensRef.current.delete(gen);
      if (transcriptReceivedGenRef.current !== gen) {
        transcriptReceivedGenRef.current = gen;
      }
      recomputeLivePhase();
    },
    [recomputeLivePhase],
  );

  /** Keep the data channel open briefly so in-flight Whisper results can still commit. */
  const waitForPendingCandidateTranscripts = useCallback(async () => {
    if (unsettledCandidateGensRef.current.size === 0) return;
    const deadline = Date.now() + TRANSCRIPT_FALLBACK_MS;
    while (unsettledCandidateGensRef.current.size > 0 && Date.now() < deadline) {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 100);
      });
    }
    unsettledCandidateGensRef.current.clear();
  }, []);

  const requestInterviewerResponse = useCallback(
    (options?: { instructions?: string; force?: boolean; ignoreVisibility?: boolean }) => {
      if (finishStartedRef.current || stageRef.current !== "live") return false;
      if (visibilityBlockedRef.current && !options?.ignoreVisibility) return false;
      if (candidateSpeechActiveRef.current) return false;
      if (!options?.force && (responseInFlightRef.current || aiAudioActiveRef.current)) {
        return false;
      }
      if (options?.force && responseInFlightRef.current && !aiAudioActiveRef.current) {
        sendRealtimeEvent({ type: "response.cancel" });
        responseInFlightRef.current = false;
      }
      return sendRealtimeEvent({
        type: "response.create",
        response: {
          ...resolveRealtimeResponseMode(voiceTtsProviderRef.current === "elevenlabs"),
          ...(options?.instructions ? { instructions: options.instructions } : {}),
        },
      });
    },
    [sendRealtimeEvent],
  );

  const scheduleInterviewerResponseAfterCandidate = useCallback(() => {
    if (candidateSpeechActiveRef.current) return;
    if (visibilityBlockedRef.current) return;
    const conversationManager = conversationManagerRef.current;
    if (!conversationManager.shouldScheduleResponseAfterCandidate()) return;
    const gen = candidateUtteranceGenRef.current;
    // Schedule on speech_stopped — wait briefly for Whisper so empty/silent turns get a check-in.
    if (utteranceStoppedGenRef.current !== gen) {
      return;
    }
    if (respondedUtteranceGenRef.current === gen) return;
    if (scheduledResponseGenRef.current === gen) return;

    const transcriptKnown = candidateTranscriptByGenRef.current.has(gen);
    const stoppedAt = speechStoppedAtMsByGenRef.current.get(gen);
    const candidateTranscript = candidateTranscriptByGenRef.current.get(gen) ?? "";
    const substantiveKnown =
      transcriptKnown && isSubstantiveCandidateTranscript(candidateTranscript);
    const turnWaitMs = substantiveKnown
      ? INTERVIEW_TURN_TIMING.transcriptTurnWaitSubstantiveMs
      : TRANSCRIPT_TURN_WAIT_MS;
    const waitExpired = stoppedAt != null && Date.now() - stoppedAt >= turnWaitMs;
    if (!transcriptKnown && !waitExpired && unsettledCandidateGensRef.current.has(gen)) {
      return;
    }

    const alreadyEvaluated = transcriptReceivedGenRef.current === gen;
    if (!alreadyEvaluated) {
      conversationManager.onTranscriptReceived(transcriptKnown ? candidateTranscript : "");
      if (transcriptKnown) {
        conversationManager.preloadResponseInstructions(candidateTranscript);
        turnPerformanceRef.current.mark(gen, "instructions_ready", {
          evaluationStatus: conversationManager.snapshot.currentEvaluationStatus,
          sessionPhase: conversationManager.snapshot.sessionPhase,
          advanced: conversationManager.canAdvanceToNextQuestion(),
        });
      }
    }

    const instructions =
      conversationManager.getResponseInstructions() ??
      conversationManager.preloadResponseInstructions(transcriptKnown ? candidateTranscript : "");
    if (!instructions) return;

    const responseDelayMs = substantiveKnown ? 0 : CANDIDATE_RESPONSE_DELAY_MS;

    // Do not clear the transcript settle timer — Whisper persistence is independent of turn-taking.
    clearCandidateResponseDelayTimer();
    scheduledResponseGenRef.current = gen;
    responseRetryCountRef.current = 0;

    const attemptResponse = (delayMs: number) => {
      clearCandidateResponseDelayTimer();
      recomputeLivePhase();
      candidateResponseDelayTimerRef.current = window.setTimeout(() => {
        candidateResponseDelayTimerRef.current = null;
        recomputeLivePhase();
        if (candidateSpeechActiveRef.current) {
          scheduledResponseGenRef.current = null;
          return;
        }
        if (utteranceStoppedGenRef.current !== gen) {
          scheduledResponseGenRef.current = null;
          return;
        }
        if (aiAudioActiveRef.current || responseInFlightRef.current) {
          if (responseRetryCountRef.current < RESPONSE_MAX_RETRIES) {
            responseRetryCountRef.current += 1;
            attemptResponse(RESPONSE_RETRY_INTERVAL_MS);
          } else {
            scheduledResponseGenRef.current = null;
          }
          return;
        }
        const sent = requestInterviewerResponse({ instructions });
        if (!sent) {
          if (responseRetryCountRef.current < RESPONSE_MAX_RETRIES) {
            responseRetryCountRef.current += 1;
            attemptResponse(RESPONSE_RETRY_INTERVAL_MS);
          } else {
            scheduledResponseGenRef.current = null;
          }
          return;
        }
        respondedUtteranceGenRef.current = gen;
        responseCreateGenRef.current = gen;
        turnPerformanceRef.current.mark(gen, "response_create_sent", {
          evaluationStatus: conversationManagerRef.current.snapshot.currentEvaluationStatus,
          sessionPhase: conversationManagerRef.current.snapshot.sessionPhase,
          advanced: conversationManagerRef.current.canAdvanceToNextQuestion(),
        });
        conversationManagerRef.current.onInterviewerResponseScheduled();
        scheduledResponseGenRef.current = null;
        responseRetryCountRef.current = 0;
      }, delayMs);
    };

    attemptResponse(responseDelayMs);
    recomputeLivePhase();
  }, [clearCandidateResponseDelayTimer, recomputeLivePhase, requestInterviewerResponse]);

  const clearAiAudioOffTimer = useCallback(() => {
    if (aiAudioOffTimerRef.current !== null) {
      window.clearTimeout(aiAudioOffTimerRef.current);
      aiAudioOffTimerRef.current = null;
    }
  }, []);

  const cancelInterviewerResponse = useCallback(() => {
    clearCandidateResponseDelayTimer();
    if (!responseInFlightRef.current && !aiAudioActiveRef.current) return;
    sendRealtimeEvent({ type: "response.cancel" });
    responseInFlightRef.current = false;
    aiAudioActiveRef.current = false;
    clearAiAudioOffTimer();
    recomputeLivePhase();
  }, [clearAiAudioOffTimer, clearCandidateResponseDelayTimer, recomputeLivePhase, sendRealtimeEvent]);

  const markAiAudioActive = useCallback(() => {
    clearAiAudioOffTimer();
    aiAudioActiveRef.current = true;
    recomputeLivePhase();
  }, [clearAiAudioOffTimer, recomputeLivePhase]);

  const scheduleAiAudioInactive = useCallback(() => {
    clearAiAudioOffTimer();
    aiAudioOffTimerRef.current = window.setTimeout(() => {
      aiAudioOffTimerRef.current = null;
      aiAudioActiveRef.current = false;
      lastInterviewerActivityAtRef.current = Date.now();
      recomputeLivePhase();
    }, AI_AUDIO_SETTLE_MS);
  }, [clearAiAudioOffTimer, recomputeLivePhase]);

  const playInterviewerTts = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      const audio = audioElementRef.current;
      if (!trimmed || !audio) return;

      try {
        const response = await fetch(`/api/interview/${sessionId}/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: trimmed,
            voiceGender: selectedVoiceGenderRef.current,
          }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? "ElevenLabs voice synthesis failed.");
        }

        const perfGen = responseCreateGenRef.current ?? utteranceStoppedGenRef.current;
        if (perfGen != null) {
          turnPerformanceRef.current.mark(perfGen, "first_audio_delta");
        }

        const blob = await response.blob();
        if (elevenLabsPlaybackUrlRef.current) {
          URL.revokeObjectURL(elevenLabsPlaybackUrlRef.current);
        }
        const url = URL.createObjectURL(blob);
        elevenLabsPlaybackUrlRef.current = url;
        audio.srcObject = null;
        audio.src = url;
        markAiAudioActive();
        await audio.play();
      } catch (error) {
        setError(error instanceof Error ? error.message : "Unable to play interviewer voice.");
        scheduleAiAudioInactive();
      }
    },
    [markAiAudioActive, scheduleAiAudioInactive, sessionId],
  );

  useEffect(() => {
    stageRef.current = stage;
    if (stage === "live") return;

    // connectRealtime sets pendingSessionGreetingRef before the first await; a transition
    // flush can run that effect while still on "connecting" — do not wipe the greeting.
    if (stage === "connecting") {
      clearAiAudioOffTimer();
      candidateSpeechActiveRef.current = false;
      responseInFlightRef.current = false;
      aiAudioActiveRef.current = false;
      setLivePhase("listening");
      return;
    }

    clearAiAudioOffTimer();
    candidateSpeechActiveRef.current = false;
    responseInFlightRef.current = false;
    aiAudioActiveRef.current = false;
    setLivePhase("listening");
    visibilityBlockedRef.current = false;
    setVisibilityBlocked(false);
    pauseReasonRef.current = null;
    setPauseReason(null);
    visibilityResumeResponseRef.current = false;
    visibilityBlockCountRef.current = 0;
    visibilityClearCountRef.current = 0;
    pauseStartedAtMsRef.current = null;
    firstInterviewerResponseStartedRef.current = false;
    practiceWrapUpTriggeredRef.current = false;
    earlyCloseTriggeredRef.current = false;
    lastPracticeNudgeAtRef.current = 0;
    candidateUtteranceStartMsRef.current = null;
    interviewerResponseStartMsRef.current = null;
    interviewerStartMsByItemRef.current.clear();
    interviewerOrderByItemRef.current.clear();
    candidatePendingOrderIndexRef.current = null;
    candidateOrderByItemRef.current.clear();
    candidateStartMsByItemRef.current.clear();
    unsettledCandidateGensRef.current.clear();
    candidateTranscriptByGenRef.current.clear();
    speechStoppedAtMsByGenRef.current.clear();
    pendingSessionGreetingRef.current = null;
    conversationManagerRef.current = new InterviewConversationManager({
      sessionType,
      keySkills: expandedKeySkills,
      predefinedQuestions:
        serverInterviewAgendaRef.current.length > 0
          ? serverInterviewAgendaRef.current
          : mandatoryQuestions,
      logTransitions: process.env.NODE_ENV === "development",
    });
    openingInterruptRestoreRef.current = false;
    setInterviewerStarting(false);
    if (openingGreetingTimerRef.current !== null) {
      window.clearTimeout(openingGreetingTimerRef.current);
      openingGreetingTimerRef.current = null;
    }
    clearCandidateResponseDelayTimer();
    clearTranscriptFallbackTimer();
    clearWhisperTurnWaitTimer();
  }, [clearAiAudioOffTimer, clearCandidateResponseDelayTimer, clearTranscriptFallbackTimer, clearWhisperTurnWaitTimer, keySkills, mandatoryQuestions, sessionType, stage]);

  // Save interview state to sessionStorage for page refresh handling
  useEffect(() => {
    // Only save if interview is live or connecting
    if (stage !== "live" && stage !== "connecting") {
      // Clear saved state when interview ends
      if (stage === "post" || stage === "error") {
        clearInterviewState(sessionId);
      }
      return;
    }

    const state: SavedInterviewState = {
      sessionId,
      stage,
      remainingSec,
      transcript: transcriptRef.current,
      timerStartedAt: timerStartedAtRef.current,
      conversationState: conversationManagerRef.current.serialize(),
      savedAt: Date.now(),
    };
    saveInterviewState(sessionId, state);
  }, [sessionId, stage, remainingSec, transcriptBump]);

  // Check for and restore saved state on component mount
  useEffect(() => {
    const savedState = loadInterviewState(sessionId);
    if (!savedState) return;

    const restoreGeneration = interviewStartGenerationRef.current;

    // Check if session is still LIVE in database
    void (async () => {
      try {
        const response = await fetch(`/api/interview/${sessionId}/details`);
        if (!response.ok) {
          clearInterviewState(sessionId);
          return;
        }
        const data = (await response.json().catch(() => null)) as {
          session?: { status: string };
        } | null;
        if (!data) {
          clearInterviewState(sessionId);
          return;
        }
        const sessionStatus = data.session?.status;

        // Only restore if session is still LIVE
        if (sessionStatus !== "LIVE") {
          clearInterviewState(sessionId);
          return;
        }

        if (restoreGeneration !== interviewStartGenerationRef.current) {
          return;
        }

        const hasInterviewerProgress = savedState.transcript.some(
          (turn) => turn.speaker === "interviewer",
        );
        const restoreTimer = shouldRestoreInterviewTimer(
          savedState.stage,
          hasInterviewerProgress,
          savedState.timerStartedAt,
        );
        const restoredRemainingSec = restoreTimer
          ? computeRemainingSec(
              durationSec,
              savedState.timerStartedAt,
              savedState.remainingSec,
            )
          : durationSec;

        transcriptRef.current = sortTranscriptTurns(
          savedState.transcript.map((turn, index) => ({
            ...turn,
            orderIndex: turn.orderIndex ?? index,
          })),
        );
        const maxOrderIndex = transcriptRef.current.reduce(
          (max, turn) => Math.max(max, turn.orderIndex),
          -1,
        );
        nextTranscriptOrderIndexRef.current = maxOrderIndex + 1;
        setTranscriptBump((n) => n + 1);
        timerStartedAtRef.current = restoreTimer ? savedState.timerStartedAt : null;
        setRemainingSec(restoredRemainingSec);

        if (savedState.conversationState) {
          conversationManagerRef.current.restore(savedState.conversationState);
        } else if (savedState.transcript.length > 0) {
          conversationManagerRef.current.rehydrateFromTranscript(
            sortTranscriptTurns(savedState.transcript).map((turn) => ({
              speaker: turn.speaker,
              text: turn.text,
            })),
          );
        }

        if (savedState.stage === "live") {
          setStage("preflight");
          setError("Interview was interrupted. Click 'Start voice interview' to reconnect.");
        } else if (savedState.stage === "connecting") {
          setStage("preflight");
          setError("Interview was interrupted. Click 'Start voice interview' to reconnect.");
        }
      } catch (e) {
        // If check fails, clear saved state and start fresh
        clearInterviewState(sessionId);
      }
    })();
  }, [durationSec, sessionId]);

  const bumpTranscriptOrderCounter = useCallback(() => {
    const maxExisting = transcriptRef.current.reduce(
      (max, turn) => Math.max(max, turn.orderIndex),
      -1,
    );
    if (nextTranscriptOrderIndexRef.current <= maxExisting) {
      nextTranscriptOrderIndexRef.current = maxExisting + 1;
    }
  }, []);

  const aliasInterviewerOrderKey = useCallback((fromKey: string, toKey: string) => {
    if (!fromKey || !toKey || fromKey === toKey) return;
    const order =
      interviewerOrderByItemRef.current.get(fromKey) ??
      interviewerOrderByItemRef.current.get(toKey);
    if (order === undefined) return;
    interviewerOrderByItemRef.current.set(fromKey, order);
    interviewerOrderByItemRef.current.set(toKey, order);
  }, []);

  const linkInterviewerRealtimeKeys = useCallback(
    (event: RealtimeEvent) => {
      const responseId = getRealtimeResponseId(event);
      if (event.item_id && responseId) {
        aliasInterviewerOrderKey(responseId, event.item_id);
      }
    },
    [aliasInterviewerOrderKey],
  );

  const reserveTranscriptOrderIndex = useCallback(
    (itemKey?: string) => {
      bumpTranscriptOrderCounter();
      if (itemKey && interviewerOrderByItemRef.current.has(itemKey)) {
        return interviewerOrderByItemRef.current.get(itemKey)!;
      }
      const orderIndex = nextTranscriptOrderIndexRef.current++;
      if (itemKey) {
        interviewerOrderByItemRef.current.set(itemKey, orderIndex);
      }
      return orderIndex;
    },
    [bumpTranscriptOrderCounter],
  );

  const commitTranscriptTurn = useCallback(
    (
      speaker: TranscriptTurn["speaker"],
      text: string,
      id?: string,
      startMs?: number,
      confidence?: number | null,
    ) => {
      const clean = text.trim();
      if (!clean) return;
      const dedupeKey = id ?? `${speaker}:${clean}`;
      if (appendedItemsRef.current.has(dedupeKey)) return;
      appendedItemsRef.current.add(dedupeKey);
      const orderIndex =
        speaker === "interviewer" && id
          ? (interviewerOrderByItemRef.current.get(id) ?? reserveTranscriptOrderIndex(id))
          : speaker === "candidate" && id && candidateOrderByItemRef.current.has(id)
            ? candidateOrderByItemRef.current.get(id)!
            : speaker === "candidate" && candidatePendingOrderIndexRef.current !== null
              ? candidatePendingOrderIndexRef.current
              : reserveTranscriptOrderIndex();
      const turn: TranscriptTurn = {
        id: dedupeKey,
        speaker,
        text: clean,
        timestampMs: startMs ?? getElapsedMs(),
        orderIndex,
        confidence: confidence ?? null,
      };
      transcriptRef.current = sortTranscriptTurns([...transcriptRef.current, turn]);
      setTranscriptBump((n) => n + 1);
      if (speaker === "interviewer") {
        firstInterviewerResponseStartedRef.current = true;
        if (id) {
          interviewerStartMsByItemRef.current.delete(id);
          interviewerOrderByItemRef.current.delete(id);
        }
        interviewerResponseStartMsRef.current = null;
      }
      if (speaker === "candidate") {
        if (id && candidateOrderByItemRef.current.has(id)) {
          const committedOrder = candidateOrderByItemRef.current.get(id)!;
          // Only clear the "current" pending pointer if it still points at this utterance.
          if (candidatePendingOrderIndexRef.current === committedOrder) {
            candidatePendingOrderIndexRef.current = null;
            candidateUtteranceStartMsRef.current = null;
          }
          candidateOrderByItemRef.current.delete(id);
          candidateStartMsByItemRef.current.delete(id);
        } else {
          candidateUtteranceStartMsRef.current = null;
          candidatePendingOrderIndexRef.current = null;
        }
      }
    },
    [getElapsedMs, reserveTranscriptOrderIndex],
  );

  const rejectVadSpeechStart = useCallback(
    (itemId: string | undefined, validation: SpeechStartValidation) => {
      if (itemId) {
        rejectedVadItemIdsRef.current.add(itemId);
      }
      if (process.env.NODE_ENV === "development") {
        console.log("[VAD] rejected speech_started", { itemId, validation });
      }
      sendRealtimeEvent({ type: "input_audio_buffer.clear" });
    },
    [sendRealtimeEvent],
  );

  const acceptCandidateSpeechStarted = useCallback(
    (data: RealtimeEvent) => {
      clearTranscriptFallbackTimer();
      clearWhisperTurnWaitTimer();
      scheduledResponseGenRef.current = null;
      responseRetryCountRef.current = 0;
      candidateUtteranceGenRef.current += 1;
      utteranceStoppedGenRef.current = null;
      transcriptReceivedGenRef.current = null;
      const startMs = getElapsedMs();
      candidateUtteranceStartMsRef.current = startMs;
      bumpTranscriptOrderCounter();
      const orderIndex = nextTranscriptOrderIndexRef.current++;
      candidatePendingOrderIndexRef.current = orderIndex;
      if (data.item_id) {
        itemUtteranceGenRef.current.set(data.item_id, candidateUtteranceGenRef.current);
        candidateOrderByItemRef.current.set(data.item_id, orderIndex);
        candidateStartMsByItemRef.current.set(data.item_id, startMs);
      }
      if (!aiAudioActiveRef.current && !responseInFlightRef.current) {
        cancelInterviewerResponse();
      }
      conversationManagerRef.current.onCandidateSpeechStarted();
      candidateSpeechActiveRef.current = true;
      vadAnalyzerRef.current?.onCandidateSpeechStarted();
      recomputeLivePhase();
    },
    [
      bumpTranscriptOrderCounter,
      cancelInterviewerResponse,
      clearTranscriptFallbackTimer,
      clearWhisperTurnWaitTimer,
      getElapsedMs,
      recomputeLivePhase,
    ],
  );

  const processCandidateSpeechStopped = useCallback(
    (data: RealtimeEvent) => {
      if (visibilityBlockedRef.current) {
        candidateSpeechActiveRef.current = false;
        sendRealtimeEvent({ type: "input_audio_buffer.clear" });
        return;
      }
      candidateSpeechActiveRef.current = false;
      vadAnalyzerRef.current?.onCandidateSpeechStopped();
      const stoppedGen = candidateUtteranceGenRef.current;
      if (data.item_id) {
        itemUtteranceGenRef.current.set(data.item_id, stoppedGen);
        if (!candidateOrderByItemRef.current.has(data.item_id)) {
          const orderIndex =
            candidatePendingOrderIndexRef.current ?? nextTranscriptOrderIndexRef.current++;
          candidateOrderByItemRef.current.set(data.item_id, orderIndex);
          candidatePendingOrderIndexRef.current = orderIndex;
        }
        if (!candidateStartMsByItemRef.current.has(data.item_id)) {
          candidateStartMsByItemRef.current.set(
            data.item_id,
            candidateUtteranceStartMsRef.current ?? getElapsedMs(),
          );
        }
      }
      conversationManagerRef.current.onCandidateSpeechStopped();
      utteranceStoppedGenRef.current = stoppedGen;
      turnPerformanceRef.current.startTurn(stoppedGen);
      turnPerformanceRef.current.mark(stoppedGen, "speech_stopped");
      unsettledCandidateGensRef.current.add(stoppedGen);
      speechStoppedAtMsByGenRef.current.set(stoppedGen, Date.now());
      clearWhisperTurnWaitTimer();
      whisperTurnWaitTimerRef.current = window.setTimeout(() => {
        whisperTurnWaitTimerRef.current = null;
        if (!candidateTranscriptByGenRef.current.has(stoppedGen)) {
          candidateTranscriptByGenRef.current.set(stoppedGen, "");
          conversationManagerRef.current.onTranscriptReceived("");
        }
        scheduleInterviewerResponseAfterCandidate();
      }, TRANSCRIPT_TURN_WAIT_MS);
      scheduleInterviewerResponseAfterCandidate();
      clearTranscriptFallbackTimer();
      transcriptFallbackTimerRef.current = window.setTimeout(() => {
        transcriptFallbackTimerRef.current = null;
        if (candidateSpeechActiveRef.current) return;
        if (utteranceStoppedGenRef.current !== stoppedGen) return;
        if (transcriptReceivedGenRef.current === stoppedGen) return;
        if (!candidateTranscriptByGenRef.current.has(stoppedGen)) {
          candidateTranscriptByGenRef.current.set(stoppedGen, "");
          conversationManagerRef.current.onTranscriptReceived("");
        }
        settleCandidateUtteranceGen(stoppedGen);
        scheduleInterviewerResponseAfterCandidate();
      }, TRANSCRIPT_FALLBACK_MS);
      recomputeLivePhase();
      updateDynamicVadSilence();
    },
    [
      clearTranscriptFallbackTimer,
      clearWhisperTurnWaitTimer,
      getElapsedMs,
      recomputeLivePhase,
      scheduleInterviewerResponseAfterCandidate,
      sendRealtimeEvent,
      settleCandidateUtteranceGen,
      updateDynamicVadSilence,
    ],
  );

  const cleanupConnection = useCallback(() => {
    channelRef.current?.close();
    peerRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioElementRef.current?.pause();
    if (elevenLabsPlaybackUrlRef.current) {
      URL.revokeObjectURL(elevenLabsPlaybackUrlRef.current);
      elevenLabsPlaybackUrlRef.current = null;
    }
    channelRef.current = null;
    peerRef.current = null;
    mediaStreamRef.current = null;
    audioElementRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    remoteAudioStreamRef.current = null;
    remoteRecordingSourceRef.current?.disconnect();
    localRecordingSourceRef.current?.disconnect();
    recordingDestinationRef.current?.disconnect();
    localRecordingSourceRef.current = null;
    remoteRecordingSourceRef.current = null;
    recordingDestinationRef.current = null;
    if (recordingAudioContextRef.current) {
      void recordingAudioContextRef.current.close().catch(() => undefined);
      recordingAudioContextRef.current = null;
    }
    clearVadConfirmTimer();
    vadAnalyzerRef.current?.detach();
  }, [clearVadConfirmTimer]);

  cleanupConnectionRef.current = cleanupConnection;

  const cleanupRealtimeOnly = useCallback(() => {
    channelRef.current?.close();
    peerRef.current?.close();
    audioElementRef.current?.pause();
    if (elevenLabsPlaybackUrlRef.current) {
      URL.revokeObjectURL(elevenLabsPlaybackUrlRef.current);
      elevenLabsPlaybackUrlRef.current = null;
    }
    channelRef.current = null;
    peerRef.current = null;
    audioElementRef.current = null;
    remoteAudioStreamRef.current = null;
  }, []);

  const setupRecordingStream = useCallback((): MediaStream | null => {
    const sourceStream = mediaStreamRef.current;
    if (!sourceStream) return null;
    const videoTrack = sourceStream.getVideoTracks()[0];
    const micTrack = sourceStream.getAudioTracks()[0];
    if (!videoTrack || !micTrack) return null;

    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    const localSource = audioContext.createMediaStreamSource(new MediaStream([micTrack]));
    localSource.connect(destination);

    recordingAudioContextRef.current = audioContext;
    recordingDestinationRef.current = destination;
    localRecordingSourceRef.current = localSource;

    if (remoteAudioStreamRef.current) {
      try {
        const remoteSource = audioContext.createMediaStreamSource(remoteAudioStreamRef.current);
        remoteSource.connect(destination);
        remoteRecordingSourceRef.current = remoteSource;
      } catch {
        remoteRecordingSourceRef.current = null;
      }
    }

    return new MediaStream([videoTrack, ...destination.stream.getAudioTracks()]);
  }, []);

  const attachRemoteAudioToRecordingMix = useCallback(() => {
    const audioContext = recordingAudioContextRef.current;
    const destination = recordingDestinationRef.current;
    const remoteStream = remoteAudioStreamRef.current;
    if (!audioContext || !destination || !remoteStream) return;
    if (remoteRecordingSourceRef.current) return;

    try {
      const remoteSource = audioContext.createMediaStreamSource(remoteStream);
      remoteSource.connect(destination);
      remoteRecordingSourceRef.current = remoteSource;
    } catch {
      remoteRecordingSourceRef.current = null;
    }
  }, []);

  const uploadRecordingBlob = useCallback(
    async (elapsed: number, blob: Blob): Promise<void> => {
      const mimeType = blob.type || "video/webm";
      const sizeBytes = blob.size;

      const fallbackApiUpload = async () => {
        const formData = new FormData();
        formData.append("video", new File([blob], `${sessionId}.webm`, { type: blob.type }));
        formData.append("durationSec", String(elapsed));
        const response = await fetch(`/api/interview/${sessionId}/video`, {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          console.error(
            `[Video Upload] Multipart upload failed for session ${sessionId}:`,
            response.status,
            response.statusText,
          );
          throw new Error(`Multipart upload failed with status ${response.status}`);
        }
        console.log(`[Video Upload] Multipart upload success for session ${sessionId}`);
      };

      const urlResponse = await fetch(`/api/interview/${sessionId}/video/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType, sizeBytes }),
      });

      if (!urlResponse.ok) {
        console.log(
          `[Video Upload] Presigned URL unavailable for session ${sessionId}, using multipart upload`,
        );
        await fallbackApiUpload();
        return;
      }

      const { uploadUrl } = (await urlResponse.json()) as { uploadUrl?: string };
      if (!uploadUrl) {
        console.log(`[Video Upload] Missing presigned URL for session ${sessionId}, using multipart upload`);
        await fallbackApiUpload();
        return;
      }

      console.log(
        `[Video Upload] Got presigned URL for session ${sessionId}, uploading ${sizeBytes} bytes`,
      );

      try {
        const response = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": mimeType },
          body: blob,
        });
        if (!response.ok) {
          const errorText = await response.text().catch(() => "No error body");
          console.error(
            `[Video Upload] S3 upload failed for session ${sessionId}:`,
            response.status,
            response.statusText,
            errorText,
          );
          throw new Error(`S3 upload failed with status ${response.status}: ${errorText}`);
        }
        console.log(`[Video Upload] S3 upload success for session ${sessionId}`);
      } catch (error) {
        console.error(`[Video Upload] S3 fetch error for session ${sessionId}:`, error);
        console.log(`[Video Upload] Falling back to multipart upload for session ${sessionId}`);
        await fallbackApiUpload();
        return;
      }

      const metadataResponse = await fetch(`/api/interview/${sessionId}/video/metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ mimeType, sizeBytes, durationSec: elapsed }),
      });

      if (!metadataResponse.ok) {
        console.error(
          `[Video Upload] Failed to update metadata for session ${sessionId}:`,
          metadataResponse.status,
          metadataResponse.statusText,
        );
      } else {
        console.log(`[Video Upload] Metadata updated for session ${sessionId}`);
      }
    },
    [sessionId],
  );

  /** Stop MediaRecorder and resolve once the blob is ready — upload continues in background. */
  const kickOffRecordingUpload = useCallback(
    (elapsed: number): Promise<void> => {
      console.log(
        `[Video Upload] kickOffRecordingUpload called: shouldRecordVideo=${shouldRecordVideo}, recorder exists=${!!mediaRecorderRef.current}, chunks=${recordingChunksRef.current.length}`,
      );
      if (!shouldRecordVideo) return Promise.resolve();
      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        console.error(`[Video Upload] No recorder found for session ${sessionId}`);
        return Promise.resolve();
      }
      setIsRecording(false);
      return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        const stopTimeout = window.setTimeout(finish, 30_000);
        recorder.onstop = () => {
          window.clearTimeout(stopTimeout);
          mediaRecorderRef.current = null;
          try {
            const blob = new Blob(recordingChunksRef.current, {
              type: recorder.mimeType || "video/webm",
            });
            recordingChunksRef.current = [];
            if (blob.size > 0) {
              setVideoUploadPending(true);
              const uploadTask = uploadRecordingBlob(elapsed, blob)
                .catch((error) => {
                  console.error(`[Video Upload] Error for session ${sessionId}:`, error);
                })
                .finally(() => {
                  setVideoUploadPending(false);
                });
              uploadInFlightRef.current = uploadTask.finally(() => {
                uploadInFlightRef.current = null;
              });
              void uploadInFlightRef.current;
            }
          } catch (error) {
            console.error(`[Video Upload] Error preparing upload for session ${sessionId}:`, error);
          }
          finish();
        };
        try {
          recorder.stop();
        } catch {
          window.clearTimeout(stopTimeout);
          mediaRecorderRef.current = null;
          finish();
        }
      });
    },
    [sessionId, shouldRecordVideo, uploadRecordingBlob],
  );

  const finishInterview = useCallback(
    async (reason: "manual" | "timer" | "disconnect") => {
      console.log(`[Interview Finish] Called with reason: ${reason}, finishStartedRef: ${finishStartedRef.current}`);
      if (finishStartedRef.current) return;
      finishStartedRef.current = true;
      conversationManagerRef.current.onSessionClosing();
      settlePause();
      setStage("ending");
      completionBeaconSentRef.current = false;

      // Freeze the interview clock before Whisper drain / upload so duration and
      // late transcript fallbacks match the allocated slot, not wall-clock overhead.
      const elapsedMs = getElapsedMs();
      finishElapsedMsRef.current = elapsedMs;
      const elapsed = Math.max(
        0,
        Math.round(elapsedMs / 1000) || durationSec - remainingSec,
      );

      if (reason === "disconnect" && transcriptRef.current.length === 0) {
        commitTranscriptTurn(
          "interviewer",
          "The interview ended before a stable realtime connection was established.",
          "disconnect-note",
        );
      }

      // Stop MediaRecorder now so the blob length tracks the interview clock
      // (not Whisper wait / complete API time). Video upload continues in background.
      const recordingStopPromise = kickOffRecordingUpload(elapsed);

      // Allow in-flight Whisper results to arrive before tearing down the data channel.
      await waitForPendingCandidateTranscripts();
      cleanupRealtimeOnly();
      await recordingStopPromise;
      cleanupConnectionRef.current();

      try {
        const response = await fetch(`/api/interview/${sessionId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            durationSec: elapsed,
            transcript: buildTranscriptPayload(transcriptRef.current),
          }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? "Unable to complete the interview.");
        }
        completionBeaconSentRef.current = true;
        setStage("post");
        clearInterviewState(sessionId);
      } catch (finishError) {
        setStage("error");
        setError(
          finishError instanceof Error
            ? finishError.message
            : "Unable to finalize the interview.",
        );
        clearInterviewState(sessionId);
      }
    },
    [cleanupRealtimeOnly, commitTranscriptTurn, durationSec, getElapsedMs, remainingSec, kickOffRecordingUpload, sessionId, settlePause, waitForPendingCandidateTranscripts],
  );

  finishInterviewRef.current = finishInterview;

  useEffect(() => {
    if (stage !== "live") return;
    const interval = window.setInterval(() => {
      // Freeze the countdown while the interview is paused (candidate not visible).
      if (pauseStartedAtMsRef.current !== null) return;
      const nextRemainingSec = computeRemainingSec(
        durationSec,
        timerStartedAtRef.current,
        durationSec,
      );
      if (nextRemainingSec <= 0) {
        window.clearInterval(interval);
        setRemainingSec(0);
        console.log(`[Timer] Timer expired, calling finishInterview with reason "timer"`);
        void finishInterviewRef.current?.("timer");
        return;
      }
      setRemainingSec(nextRemainingSec);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [durationSec, stage]);

  useEffect(() => {
    if (stage !== "live") return;
    if (remainingSec <= 0) return;

    const wrapUpWindowSec =
      sessionType === "PRACTICE"
        ? Math.max(1, Math.min(PRACTICE_WRAP_UP_WINDOW_SEC, durationSec))
        : Math.max(1, Math.min(COMPANY_WRAP_UP_WINDOW_SEC, durationSec));
    if (remainingSec > wrapUpWindowSec) return;
    if (practiceWrapUpTriggeredRef.current) return;
    if (channelRef.current?.readyState !== "open") return;

    practiceWrapUpTriggeredRef.current = true;
    const wrapUpText =
      sessionType === "PRACTICE"
        ? [
            "Practice interview timing is in final wrap-up window.",
            "Ask one concise final question if needed, then provide a brief closing remark.",
            "Do not start any new long question chain.",
          ].join(" ")
        : [
            "Interview timing is in the final wrap-up window.",
            "Finish any current topic briefly, then provide a professional closing remark.",
            "Do not start any new long question chain.",
          ].join(" ");
    sendRealtimeEvent({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: wrapUpText,
          },
        ],
      },
    });
    requestInterviewerResponse({ force: true });
  }, [durationSec, remainingSec, requestInterviewerResponse, sendRealtimeEvent, sessionType, stage]);

  useEffect(() => {
    if (stage !== "live") return;
    const wrapUpWindowSec =
      sessionType === "PRACTICE"
        ? Math.max(1, Math.min(PRACTICE_WRAP_UP_WINDOW_SEC, durationSec))
        : Math.max(1, Math.min(COMPANY_WRAP_UP_WINDOW_SEC, durationSec));
    if (remainingSec <= wrapUpWindowSec) return;

    const inactivityNudgeSec =
      sessionType === "PRACTICE" ? PRACTICE_INACTIVITY_NUDGE_SEC : COMPANY_INACTIVITY_NUDGE_SEC;

    const interval = window.setInterval(() => {
      if (finishStartedRef.current) return;
      if (visibilityBlockedRef.current) return;
      if (channelRef.current?.readyState !== "open") return;
      if (candidateSpeechActiveRef.current) return;
      if (livePhase === "speaking" || livePhase === "you-speaking" || livePhase === "processing") {
        return;
      }

      const now = Date.now();
      const silentForMs = now - lastInterviewerActivityAtRef.current;
      const sinceLastNudgeMs = now - lastPracticeNudgeAtRef.current;

      if (livePhase === "thinking") {
        if (silentForMs < STUCK_THINKING_NUDGE_SEC * 1000) return;
        responseInFlightRef.current = false;
      } else if (silentForMs < inactivityNudgeSec * 1000) {
        return;
      }

      if (sinceLastNudgeMs < INACTIVITY_NUDGE_COOLDOWN_SEC * 1000) return;

      lastPracticeNudgeAtRef.current = now;
      clearCandidateResponseDelayTimer();
      sendRealtimeEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildSilenceCheckInResponseInstructions(),
            },
          ],
        },
      });
      requestInterviewerResponse({ force: true });
    }, 2000);

    return () => window.clearInterval(interval);
  }, [
    clearCandidateResponseDelayTimer,
    durationSec,
    livePhase,
    remainingSec,
    requestInterviewerResponse,
    sendRealtimeEvent,
    sessionType,
    stage,
  ]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      const activeStage =
        stageRef.current === "connecting" ||
        stageRef.current === "live" ||
        stageRef.current === "ending";
      if (activeStage || uploadInFlightRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, []);

  useEffect(
    () => () => {
      cleanupConnectionRef.current();
    },
    [],
  );

  const handlePreflight = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 },
        },
        video: { width: 1280, height: 720, facingMode: "user" },
      });
      mediaStreamRef.current = stream;
      const requestVisibilityEval = () => {
        if (stageRef.current === "live") {
          evaluateVisibilityRef.current();
        }
      };
      stream.getTracks().forEach((track) => {
        track.onmute = requestVisibilityEval;
        track.onunmute = requestVisibilityEval;
        track.onended = requestVisibilityEval;
      });
      attachVadAnalyzer();
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => null);
      }
      setPermissionReady(true);
      setError("");
      preloadFaceDetector();
    } catch (preflightError) {
      setPermissionReady(false);
      setError(
        preflightError instanceof Error
          ? preflightError.message
          : "Camera or microphone access was denied.",
      );
    }
  };

  useEffect(() => {
    const stream = mediaStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => {
      t.enabled = camOn;
    });
  }, [camOn]);

  useEffect(() => {
    const stream = mediaStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = micOn;
    });
  }, [micOn]);

  const camOnRef = useRef(camOn);
  useEffect(() => {
    camOnRef.current = camOn;
  }, [camOn]);

  const micOnRef = useRef(micOn);
  useEffect(() => {
    micOnRef.current = micOn;
  }, [micOn]);

  const pauseForVisibility = useCallback((reason: InterviewPauseReason) => {
    if (visibilityBlockedRef.current) {
      if (pauseReasonRef.current !== reason) {
        pauseReasonRef.current = reason;
        setPauseReason(reason);
      }
      return;
    }
    visibilityBlockedRef.current = true;
    pauseReasonRef.current = reason;
    setPauseReason(reason);
    setVisibilityBlocked(true);
    if (pauseStartedAtMsRef.current === null) {
      pauseStartedAtMsRef.current = Date.now();
    }
    clearCandidateResponseDelayTimer();
    clearTranscriptFallbackTimer();
    clearWhisperTurnWaitTimer();
    clearVadConfirmTimer();
    pendingVadSpeechRef.current = null;
    visibilityResumeResponseRef.current = false;
    // Drop stale turn-taking state so resume cannot schedule a next-question response.
    utteranceStoppedGenRef.current = null;
    scheduledResponseGenRef.current = null;
    respondedUtteranceGenRef.current = null;
    responseCreateGenRef.current = null;
    candidateSpeechActiveRef.current = false;
    sendRealtimeEvent({ type: "input_audio_buffer.clear" });
    cancelInterviewerResponse();
  }, [
    cancelInterviewerResponse,
    clearCandidateResponseDelayTimer,
    clearTranscriptFallbackTimer,
    clearVadConfirmTimer,
    clearWhisperTurnWaitTimer,
    sendRealtimeEvent,
  ]);

  const resumeFromVisibility = useCallback(() => {
    if (!visibilityBlockedRef.current) return;
    visibilityBlockedRef.current = false;
    pauseReasonRef.current = null;
    setPauseReason(null);
    setVisibilityBlocked(false);
    settlePause();
    if (timerStartedAtRef.current) {
      setRemainingSec((prev) => computeRemainingSec(durationSec, timerStartedAtRef.current, prev));
    }
    lastInterviewerActivityAtRef.current = Date.now();
    if (stageRef.current === "live" && channelRef.current?.readyState === "open") {
      responseInFlightRef.current = false;
      visibilityResumeResponseRef.current = true;
      const currentQuestionText =
        conversationManagerRef.current.snapshot.currentQuestion?.text ?? null;
      const sent = requestInterviewerResponse({
        instructions: buildResumeAfterPauseResponseInstructions(currentQuestionText),
        force: true,
        ignoreVisibility: true,
      });
      if (!sent) {
        visibilityResumeResponseRef.current = false;
      }
    }
  }, [durationSec, requestInterviewerResponse, settlePause]);

  const evaluateVisibilityRef = useRef<() => void>(() => {});

  const evaluateVisibility = useCallback(() => {
    if (stageRef.current !== "live") return;
    if (visibilityEvalInFlightRef.current) return;

    const runEvaluation = async () => {
      visibilityEvalInFlightRef.current = true;
      try {
        let obscured: boolean;
        let blockReason: InterviewPauseReason;
        const videoTrack = mediaStreamRef.current?.getVideoTracks()[0];
        const audioTrack = mediaStreamRef.current?.getAudioTracks()[0];
        const cameraUnavailable =
          !camOnRef.current ||
          !videoTrack ||
          !videoTrack.enabled ||
          videoTrack.readyState !== "live" ||
          videoTrack.muted;
        const microphoneUnavailable =
          !micOnRef.current ||
          !audioTrack ||
          !audioTrack.enabled ||
          audioTrack.readyState !== "live" ||
          audioTrack.muted;
        if (cameraUnavailable) {
          obscured = true;
          blockReason = "camera";
        } else if (microphoneUnavailable) {
          obscured = true;
          blockReason = "mic";
        } else {
          const video = videoRef.current;
          if (!video || video.readyState < 2 || video.videoWidth === 0) return;
          if (!detectionCanvasRef.current) {
            detectionCanvasRef.current = document.createElement("canvas");
          }
          const visibility = await evaluateCandidateVisibility(
            video,
            detectionCanvasRef.current,
          );
          obscured = visibility.obscured;
          blockReason = "face";
        }

        if (obscured) {
          visibilityClearCountRef.current = 0;
          visibilityBlockCountRef.current += 1;
          if (visibilityBlockedRef.current && pauseReasonRef.current !== blockReason) {
            pauseReasonRef.current = blockReason;
            setPauseReason(blockReason);
          }
          if (
            !visibilityBlockedRef.current &&
            visibilityBlockCountRef.current >= VISIBILITY_BLOCK_SAMPLES
          ) {
            pauseForVisibility(blockReason);
          }
        } else {
          visibilityBlockCountRef.current = 0;
          visibilityClearCountRef.current += 1;
          if (
            visibilityBlockedRef.current &&
            visibilityClearCountRef.current >= VISIBILITY_CLEAR_SAMPLES
          ) {
            resumeFromVisibility();
          }
        }
      } finally {
        visibilityEvalInFlightRef.current = false;
      }
    };

    void runEvaluation();
  }, [pauseForVisibility, resumeFromVisibility]);

  useEffect(() => {
    evaluateVisibilityRef.current = evaluateVisibility;
  }, [evaluateVisibility]);

  useEffect(() => {
    if (stage !== "live") return;
    if (!camOn) {
      visibilityBlockCountRef.current = VISIBILITY_BLOCK_SAMPLES;
      pauseForVisibility("camera");
      return;
    }
    if (!micOn) {
      visibilityBlockCountRef.current = VISIBILITY_BLOCK_SAMPLES;
      pauseForVisibility("mic");
    }
  }, [camOn, micOn, pauseForVisibility, stage]);

  useEffect(() => {
    if (stage !== "live") {
      visibilityBlockCountRef.current = 0;
      visibilityClearCountRef.current = 0;
      return;
    }
    const interval = window.setInterval(evaluateVisibility, VISIBILITY_SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [stage, evaluateVisibility]);

  const restoreOpeningInterrupt = useCallback(() => {
    // Keep interrupt_response disabled to prevent AI from interrupting candidate
    if (!openingInterruptRestoreRef.current) return;
    openingInterruptRestoreRef.current = false;
  }, []);

  const triggerOpeningGreeting = useCallback(
    (resume: boolean) => {
      if (!resume) {
        conversationManagerRef.current = new InterviewConversationManager({
          sessionType,
          keySkills: expandedKeySkills,
          predefinedQuestions:
        serverInterviewAgendaRef.current.length > 0
          ? serverInterviewAgendaRef.current
          : mandatoryQuestions,
          logTransitions: process.env.NODE_ENV === "development",
        });
      }

      if (resume) {
        const transcriptSoFar = formatTranscriptForResume(transcriptRef.current, 12);
        sendRealtimeEvent({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: [
                  "The realtime voice connection dropped mid-interview.",
                  "Resume the same interview without restarting.",
                  "Transcript so far (most recent last):",
                  transcriptSoFar,
                  "Repeat your last question clearly, then continue.",
                ].join("\n"),
              },
            ],
          },
        });
      }

      sendRealtimeEvent({ type: "input_audio_buffer.clear" });

      // Unblock the initial greeting from being dropped by the in-flight check
      responseInFlightRef.current = false;

      sendRealtimeEvent({
        type: "response.create",
        response: {
          ...resolveRealtimeResponseMode(voiceTtsProviderRef.current === "elevenlabs"),
          instructions: resume
            ? "The voice connection dropped. Repeat your last question clearly, then continue the interview."
            : buildOpeningGreetingResponseInstructions({
                candidateName,
                sessionType,
                interviewerDisplayName:
                  sessionType === "COMPANY"
                    ? interviewerName?.trim() || interviewerDisplayName
                    : null,
                companyName: sessionType === "COMPANY" ? companyName : null,
              }),
        },
      });
    },
    [
      candidateName,
      companyName,
      interviewerDisplayName,
      interviewerName,
      expandedKeySkills,
      mandatoryQuestions,
      sendRealtimeEvent,
      sessionType,
    ],
  );

  const scheduleOpeningGreetingFallback = useCallback(() => {
    if (openingGreetingTimerRef.current !== null) {
      window.clearTimeout(openingGreetingTimerRef.current);
    }
    openingGreetingTimerRef.current = window.setTimeout(() => {
      openingGreetingTimerRef.current = null;
      const pending = pendingSessionGreetingRef.current;
      if (!pending) return;
      pendingSessionGreetingRef.current = null;
      setInterviewerStarting(false);
      triggerOpeningGreeting(pending.resume);
    }, OPENING_GREETING_FALLBACK_MS);
  }, [triggerOpeningGreeting]);

  const flushPendingSessionGreeting = useCallback(() => {
    const pending = pendingSessionGreetingRef.current;
    if (!pending) return;
    if (channelRef.current?.readyState !== "open") return;
    pendingSessionGreetingRef.current = null;
    setInterviewerStarting(false);
    if (openingGreetingTimerRef.current !== null) {
      window.clearTimeout(openingGreetingTimerRef.current);
      openingGreetingTimerRef.current = null;
    }
    triggerOpeningGreeting(pending.resume);
  }, [triggerOpeningGreeting]);

  const fetchRealtimeToken = async () => {
    const cacheKey = `${REALTIME_TOKEN_CACHE_PREFIX}${sessionId}`;
    const voiceGender = selectedVoiceGenderRef.current;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as {
          realtimeToken?: string;
          expiresAt?: string;
          voiceGender?: InterviewerVoiceGender;
          voiceTtsProvider?: VoiceTtsProvider;
          instructions?: string;
          interviewQuestions?: string[];
        };
        const expiresMs = cached.expiresAt ? Date.parse(cached.expiresAt) : 0;
        if (
          cached.realtimeToken &&
          cached.voiceGender === voiceGender &&
          expiresMs - Date.now() > REALTIME_TOKEN_EXPIRY_BUFFER_MS
        ) {
          if (cached.voiceTtsProvider) {
            voiceTtsProviderRef.current = cached.voiceTtsProvider;
          }
          if (cached.instructions?.trim()) {
            serverRealtimeInstructionsRef.current = cached.instructions;
          }
          if (cached.interviewQuestions?.length) {
            serverInterviewAgendaRef.current = cached.interviewQuestions;
            conversationManagerRef.current.setPredefinedQuestions(cached.interviewQuestions);
            transcriptionContextRef.current = {
              ...transcriptionContextRef.current,
              interviewQuestions: cached.interviewQuestions,
            };
          }
          return cached.realtimeToken;
        }
      }
    } catch {
      // Ignore cache read errors — fetch a fresh token.
    }

    const response = await fetch(`/api/interview/${sessionId}/realtime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceGender }),
    });
    const payload = (await response.json()) as {
      realtimeToken?: string;
      expiresAt?: string;
      instructions?: string;
      interviewQuestions?: string[];
      voiceTtsProvider?: VoiceTtsProvider;
      error?: string;
    };
    if (!response.ok || !payload.realtimeToken) {
      throw new Error(
        payload.error ?? "OpenAI realtime is not configured. Add OPENAI_API_KEY and try again.",
      );
    }

    voiceTtsProviderRef.current = payload.voiceTtsProvider ?? "openai";

    if (payload.instructions?.trim()) {
      serverRealtimeInstructionsRef.current = payload.instructions;
    }
    if (payload.interviewQuestions?.length) {
      serverInterviewAgendaRef.current = payload.interviewQuestions;
      conversationManagerRef.current.setPredefinedQuestions(payload.interviewQuestions);
      transcriptionContextRef.current = {
        ...transcriptionContextRef.current,
        interviewQuestions: payload.interviewQuestions,
      };
    }

    try {
      sessionStorage.setItem(
        cacheKey,
        JSON.stringify({
          realtimeToken: payload.realtimeToken,
          expiresAt: payload.expiresAt,
          voiceGender,
          voiceTtsProvider: payload.voiceTtsProvider ?? "openai",
          instructions: payload.instructions,
          interviewQuestions: payload.interviewQuestions,
        }),
      );
    } catch {
      // Ignore cache write errors.
    }

    return payload.realtimeToken;
  };

  const handleRealtimeMessage = (event: MessageEvent<string>) => {
    const data = JSON.parse(event.data) as RealtimeEvent;

    if (data.type === "error") {
      const message =
        data.error?.message ??
        data.response?.status_details?.error?.message ??
        "Voice interview connection error.";
      setError(message);
      return;
    }

    if (data.type === "session.created" || data.type === "session.updated") {
      flushPendingSessionGreeting();
    }
    const isAudioOutputDelta =
      data.type === "response.audio.delta" ||
      data.type === "response.output_audio.delta" ||
      data.type === "response.output_audio_transcript.delta";
    const isTextOutputDelta = data.type === "response.output_text.delta";

    if (isAudioOutputDelta) {
      markAiAudioActive();
      const perfGen = responseCreateGenRef.current ?? utteranceStoppedGenRef.current;
      if (perfGen != null) {
        turnPerformanceRef.current.mark(perfGen, "first_audio_delta");
      }
      lastInterviewerActivityAtRef.current = Date.now();
      linkInterviewerRealtimeKeys(data);
      if (data.item_id && !interviewerStartMsByItemRef.current.has(data.item_id)) {
        interviewerStartMsByItemRef.current.set(
          data.item_id,
          interviewerResponseStartMsRef.current ?? getElapsedMs(),
        );
        reserveTranscriptOrderIndex(data.item_id);
      }
    }

    if (isTextOutputDelta) {
      lastInterviewerActivityAtRef.current = Date.now();
      linkInterviewerRealtimeKeys(data);
      if (data.item_id && !interviewerStartMsByItemRef.current.has(data.item_id)) {
        interviewerStartMsByItemRef.current.set(
          data.item_id,
          interviewerResponseStartMsRef.current ?? getElapsedMs(),
        );
        reserveTranscriptOrderIndex(data.item_id);
      }
    }

    if (data.type === "response.output_audio_transcript.delta" && data.delta) {
      setLiveInterviewerPartial((prev) => prev + data.delta);
    }

    if (data.type === "response.output_text.delta" && data.delta) {
      setLiveInterviewerPartial((prev) => prev + data.delta);
    }

    const interviewerTranscript =
      data.type === "response.output_audio_transcript.done" && data.transcript
        ? data.transcript
        : data.type === "response.output_text.done" && data.text
          ? data.text
          : null;

    if (interviewerTranscript) {
      setLiveInterviewerPartial("");
      linkInterviewerRealtimeKeys(data);
      const interviewerStartMs =
        (data.item_id ? interviewerStartMsByItemRef.current.get(data.item_id) : undefined) ??
        interviewerResponseStartMsRef.current ??
        getElapsedMs();
      commitTranscriptTurn("interviewer", interviewerTranscript, data.item_id, interviewerStartMs, 1);
      const wasVisibilityResume = visibilityResumeResponseRef.current;
      if (wasVisibilityResume) {
        visibilityResumeResponseRef.current = false;
        conversationManagerRef.current.onVisibilityResumeUtterance(interviewerTranscript);
      } else {
        conversationManagerRef.current.onInterviewerUtterance(interviewerTranscript);
      }
      const perfGen = responseCreateGenRef.current ?? utteranceStoppedGenRef.current;
      if (perfGen != null) {
        turnPerformanceRef.current.mark(perfGen, "interviewer_transcript_done");
        turnPerformanceRef.current.finishTurn(perfGen);
        responseCreateGenRef.current = null;
      }
      lastInterviewerActivityAtRef.current = Date.now();
      if (voiceTtsProviderRef.current === "elevenlabs") {
        void playInterviewerTts(interviewerTranscript);
      } else {
        scheduleAiAudioInactive();
      }
      recomputeLivePhase();
      restoreOpeningInterrupt();

      if (
        !wasVisibilityResume &&
        !candidateSpeechActiveRef.current &&
        utteranceStoppedGenRef.current !== null
      ) {
        scheduleInterviewerResponseAfterCandidate();
      }

      if (
        !earlyCloseTriggeredRef.current &&
        !finishStartedRef.current &&
        stageRef.current === "live" &&
        isInterviewerClosingRemark(interviewerTranscript)
      ) {
        const conversationManager = conversationManagerRef.current;
        const allQuestionsComplete = conversationManager.areAllPlannedQuestionsComplete();
        const elapsedSec = Math.round(getElapsedMs() / 1000);
        const minElapsedForEarlyClose = Math.max(
          EARLY_CLOSE_MIN_ELAPSED_SEC,
          Math.round(durationSec * EARLY_CLOSE_MIN_PROGRESS_RATIO),
        );
        const canCloseEarly = allQuestionsComplete || elapsedSec >= minElapsedForEarlyClose;
        if (canCloseEarly) {
          earlyCloseTriggeredRef.current = true;
          conversationManager.onSessionClosing();
          // Wait for closing remark audio to finish before tearing down WebRTC.
          window.setTimeout(() => {
            void finishInterviewRef.current?.("timer");
          }, 6000);
        }
      }
    }

    if (data.type === "conversation.item.input_audio_transcription.delta") {
      // Accumulate logprobs for confidence scoring — never commit partial transcript text.
      if (data.item_id && data.logprobs?.length) {
        const existing = logprobsByItemRef.current.get(data.item_id) ?? [];
        logprobsByItemRef.current.set(data.item_id, [...existing, ...data.logprobs]);
      }
    }

    if (data.type === "conversation.item.input_audio_transcription.completed") {
      const itemGen = data.item_id ? itemUtteranceGenRef.current.get(data.item_id) : undefined;
      const resolvedGen = itemGen ?? candidateUtteranceGenRef.current;
      if (data.item_id && rejectedVadItemIdsRef.current.has(data.item_id)) {
        rejectedVadItemIdsRef.current.delete(data.item_id);
        conversationManagerRef.current.onTranscriptReceived("");
        candidateTranscriptByGenRef.current.set(resolvedGen, "");
        settleCandidateUtteranceGen(resolvedGen);
        scheduleInterviewerResponseAfterCandidate();
        return;
      }
      const rawTranscript = typeof data.transcript === "string" ? data.transcript : "";
      const itemLogprobs =
        data.logprobs ??
        (data.item_id ? logprobsByItemRef.current.get(data.item_id) : undefined);
      const processed = processCandidateTranscript(rawTranscript, itemLogprobs, {
        transcriptionContext: transcriptionContextRef.current,
      });
      if (data.item_id) {
        logprobsByItemRef.current.delete(data.item_id);
      }
      const transcriptText = processed.text;
      const conversationManager = conversationManagerRef.current;
      const confidenceValidation = validateTranscriptConfidence({
        text: transcriptText,
        confidence: processed.confidence,
        rejectedAsNoise: processed.rejectedAsNoise,
        retryCount: conversationManager.snapshot.transcriptRetryCount,
      });
      logTranscriptConfidence({
        utteranceGen: resolvedGen,
        itemId: data.item_id,
        confidence: processed.confidence,
        threshold: confidenceValidation.threshold,
        retryCount: confidenceValidation.retryCount,
        accepted: confidenceValidation.accepted,
        reason: confidenceValidation.reason,
        textPreview: rawTranscript,
        shouldRetry:
          confidenceValidation.accepted === false
            ? confidenceValidation.shouldRetry
            : undefined,
      });
      const wasAlreadyResponded = respondedUtteranceGenRef.current === resolvedGen;
      const isSubstantive =
        confidenceValidation.accepted && isSubstantiveCandidateTranscript(transcriptText);
      vadAnalyzerRef.current?.setLastUtteranceSubstantive(isSubstantive);
      const alreadyEvaluated = transcriptReceivedGenRef.current === resolvedGen;
      transcriptReceivedGenRef.current = resolvedGen;
      if (!alreadyEvaluated) {
        if (confidenceValidation.accepted) {
          conversationManager.onTranscriptReceived(transcriptText);
        } else if (confidenceValidation.reason === "below_threshold") {
          conversationManager.onTranscriptLowConfidence();
        } else {
          conversationManager.onTranscriptReceived(transcriptText);
        }
      }
      turnPerformanceRef.current.mark(resolvedGen, "transcript_received", {
        evaluationStatus: conversationManager.snapshot.currentEvaluationStatus,
      });
      const schedulingTranscript = confidenceValidation.accepted ? transcriptText : "";
      conversationManager.preloadResponseInstructions(schedulingTranscript);
      turnPerformanceRef.current.mark(resolvedGen, "instructions_ready", {
        evaluationStatus: conversationManager.snapshot.currentEvaluationStatus,
        sessionPhase: conversationManager.snapshot.sessionPhase,
        advanced: conversationManager.canAdvanceToNextQuestion(),
      });
      candidateTranscriptByGenRef.current.set(resolvedGen, schedulingTranscript);
      // Always commit late Whisper results — dropping by gen lost answers when the candidate
      // started speaking again (or finish) before transcription.completed arrived.
      const startMs =
        (data.item_id ? candidateStartMsByItemRef.current.get(data.item_id) : undefined) ??
        candidateUtteranceStartMsRef.current ??
        getElapsedMs();
      if (transcriptText && confidenceValidation.accepted) {
        commitTranscriptTurn(
          "candidate",
          transcriptText,
          data.item_id,
          startMs,
          processed.confidence,
        );
      }
      settleCandidateUtteranceGen(resolvedGen);
      // Whisper can arrive after the turn-wait timeout already scheduled a silence check-in.
      if (wasAlreadyResponded && isSubstantive) {
        respondedUtteranceGenRef.current = null;
        scheduledResponseGenRef.current = null;
        clearCandidateResponseDelayTimer();
        if (responseInFlightRef.current || aiAudioActiveRef.current) {
          cancelInterviewerResponse();
        }
      }
      scheduleInterviewerResponseAfterCandidate();
    }

    if (data.type === "conversation.item.input_audio_transcription.failed") {
      const itemGen = data.item_id ? itemUtteranceGenRef.current.get(data.item_id) : undefined;
      const resolvedGen = itemGen ?? candidateUtteranceGenRef.current;
      if (data.item_id) {
        rejectedVadItemIdsRef.current.delete(data.item_id);
      }
      conversationManagerRef.current.onTranscriptReceived("");
      candidateTranscriptByGenRef.current.set(resolvedGen, "");
      settleCandidateUtteranceGen(resolvedGen);
      scheduleInterviewerResponseAfterCandidate();
    }

    if (data.type === "input_audio_buffer.speech_started") {
      if (visibilityBlockedRef.current) {
        if (data.item_id) {
          rejectedVadItemIdsRef.current.add(data.item_id);
        }
        sendRealtimeEvent({ type: "input_audio_buffer.clear" });
        return;
      }
      if (data.item_id && rejectedVadItemIdsRef.current.has(data.item_id)) {
        return;
      }

      const startedAt = Date.now();
      pendingVadSpeechRef.current = {
        itemId: data.item_id,
        startedAt,
        serverEvent: data,
      };

      clearVadConfirmTimer();
      vadConfirmTimerRef.current = window.setTimeout(() => {
        vadConfirmTimerRef.current = null;
        const pending = pendingVadSpeechRef.current;
        if (!pending) return;
        pendingVadSpeechRef.current = null;
        const validation = vadAnalyzerRef.current?.validateSpeechStart() ?? {
          accept: true,
          soundClass: "speech" as const,
          reason: "analyzer_unavailable",
        };
        if (!validation.accept) {
          rejectVadSpeechStart(pending.itemId, validation);
          return;
        }
        acceptCandidateSpeechStarted(pending.serverEvent);
      }, vadConfig.speechConfirmMs);
    }

    if (
      data.type === "input_audio_buffer.speech_stopped" ||
      data.type === "input_audio_buffer.speech_ended"
    ) {
      if (data.item_id && rejectedVadItemIdsRef.current.has(data.item_id)) {
        return;
      }

      const pending = pendingVadSpeechRef.current;
      if (pending) {
        clearVadConfirmTimer();
        pendingVadSpeechRef.current = null;
        const validation = vadAnalyzerRef.current?.validateSpeechStart() ?? {
          accept: true,
          soundClass: "speech" as const,
          reason: "analyzer_unavailable",
        };
        const durationMs = Date.now() - pending.startedAt;
        if (
          !validation.accept ||
          isShortKeyboardUtterance(durationMs, validation, vadConfig)
        ) {
          rejectVadSpeechStart(pending.itemId ?? data.item_id, validation);
          return;
        }
        acceptCandidateSpeechStarted(pending.serverEvent);
      }

      if (!candidateSpeechActiveRef.current) {
        return;
      }

      processCandidateSpeechStopped(data);
    }

    if (data.type === "response.created") {
      interviewerResponseStartMsRef.current = getElapsedMs();
      const responseItemKey = data.item_id ?? getRealtimeResponseId(data);
      if (responseItemKey) {
        reserveTranscriptOrderIndex(responseItemKey);
      }
      linkInterviewerRealtimeKeys(data);
      responseInFlightRef.current = true;
      recomputeLivePhase();
    }

    if (data.type === "response.done") {
      responseInFlightRef.current = false;
      conversationManagerRef.current.onInterviewerResponseComplete();
      if (voiceTtsProviderRef.current !== "elevenlabs") {
        scheduleAiAudioInactive();
      }
      recomputeLivePhase();
      restoreOpeningInterrupt();
      if (data.response?.status === "failed") {
        const message =
          data.response.status_details?.error?.message ?? "Interviewer could not respond.";
        setError(message);
      }
    }
  };

  const connectRealtime = async (input: { resume: boolean }) => {
    if (!mediaStreamRef.current) {
      throw new Error("Camera and microphone stream is not available.");
    }

    if (openingGreetingTimerRef.current !== null) {
      window.clearTimeout(openingGreetingTimerRef.current);
      openingGreetingTimerRef.current = null;
    }

    cleanupRealtimeOnly();

    pendingSessionGreetingRef.current = { resume: input.resume };
    openingInterruptRestoreRef.current = true;
    setInterviewerStarting(true);

    const ephemeralToken = await fetchRealtimeToken();
    const pc = new RTCPeerConnection();
    const audioElement = document.createElement("audio");
    audioElement.autoplay = true;
    audioElement.addEventListener("play", () => {
      markAiAudioActive();
    });
    audioElement.addEventListener("playing", () => {
      markAiAudioActive();
      firstInterviewerResponseStartedRef.current = true;
    });
    audioElement.addEventListener("pause", () => {
      scheduleAiAudioInactive();
    });
    audioElement.addEventListener("ended", () => {
      scheduleAiAudioInactive();
    });

    const scheduleReconnect = (label: string) => {
      if (finishStartedRef.current || reconnectInFlightRef.current) return;
      if (stageRef.current !== "live" && stageRef.current !== "connecting") return;

      const MAX_ATTEMPTS = 4;
      reconnectInFlightRef.current = true;
      reconnectAttemptsRef.current += 1;
      const attempt = reconnectAttemptsRef.current;

      setStage("connecting");
      setError(`Voice connection dropped (${label}). Reconnecting...`);

      const backoffMs = Math.min(15_000, 800 * 2 ** Math.max(0, attempt - 1));

      window.setTimeout(() => {
        void (async () => {
          try {
            await connectRealtime({ resume: true });
            reconnectAttemptsRef.current = 0;
            setError("");
            setStage("live");
          } catch (reconnectError) {
            if (attempt >= MAX_ATTEMPTS) {
              setError(
                reconnectError instanceof Error
                  ? reconnectError.message
                  : "Unable to restore the voice connection.",
              );
              void finishInterviewRef.current?.("disconnect");
            } else {
              reconnectInFlightRef.current = false;
              scheduleReconnect(label);
              return;
            }
          }
          reconnectInFlightRef.current = false;
        })();
      }, backoffMs);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "failed" || state === "disconnected") {
        scheduleReconnect(`connection ${state}`);
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "failed" || state === "disconnected") {
        scheduleReconnect(`ice ${state}`);
      }
    };

    pc.ontrack = (trackEvent) => {
      const stream = trackEvent.streams[0];
      if (voiceTtsProviderRef.current === "elevenlabs") {
        remoteAudioStreamRef.current = stream;
        return;
      }
      audioElement.srcObject = stream;
      remoteAudioStreamRef.current = stream;
      attachRemoteAudioToRecordingMix();
    };

    const micTrack = mediaStreamRef.current.getAudioTracks()[0];
    if (!micTrack) throw new Error("No microphone track is available.");
    pc.addTrack(micTrack, mediaStreamRef.current);

    const channel = pc.createDataChannel("oai-events");
    channel.addEventListener("message", handleRealtimeMessage);
    channel.addEventListener("close", () => {
      scheduleReconnect("data channel closed");
    });

    peerRef.current = pc;
    channelRef.current = channel;
    audioElementRef.current = audioElement;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ephemeralToken}`,
        "Content-Type": "application/sdp",
      },
      body: offer.sdp,
    });

    if (!sdpResponse.ok) {
      throw new Error(await sdpResponse.text());
    }

    const answerSdp = await sdpResponse.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    // Mark LIVE without anchoring startedAt yet when the interview clock has not begun
    // (fresh start). Resume reconnects keep the original startedAt from the server.
    await fetch(`/api/interview/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "LIVE",
        ...(input.resume ? {} : { deferStartedAt: true }),
      }),
    });

    channel.addEventListener(
      "open",
      () => {
        sendRealtimeEvent({
          type: "session.update",
          session: buildRealtimeSessionConfig(
            serverRealtimeInstructionsRef.current ?? fallbackInstructions,
            {
              interruptResponse: false,
              voice: realtimeVoice,
              useElevenLabsTts: voiceTtsProviderRef.current === "elevenlabs",
              transcription: transcriptionContextRef.current,
            },
          ),
        });

        candidateSpeechActiveRef.current = false;
        responseInFlightRef.current = false;
        aiAudioActiveRef.current = false;
        clearAiAudioOffTimer();
        recomputeLivePhase();
        scheduleOpeningGreetingFallback();
        // session.updated may not fire when config matches client_secret; greet proactively.
        window.setTimeout(() => {
          flushPendingSessionGreeting();
        }, OPENING_GREETING_DELAY_MS);
      },
      { once: true },
    );
  };

  const startInterview = () => {
    interviewStartGenerationRef.current += 1;
    startTransition(async () => {
      if (!consentChecked) {
        setError("Please accept the Terms and Privacy Policy before starting.");
        return;
      }
      if (!permissionReady) {
        setError("Run the device check before starting the interview.");
        return;
      }
      if (!mediaStreamRef.current) {
        setError("Camera and microphone stream is not available.");
        return;
      }
      if (!camOn) {
        setError("Please turn on your camera before starting the interview.");
        return;
      }
      const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
      if (!videoTrack || !videoTrack.enabled || videoTrack.readyState !== "live") {
        setError("Please turn on your camera before starting the interview.");
        return;
      }
      setError("");
      setStage("connecting");
      try {
        const consentRes = await fetch(`/api/interview/${sessionId}/consent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accepted: true }),
        });
        if (!consentRes.ok) {
          const consentPayload = (await consentRes.json().catch(() => null)) as { error?: string } | null;
          throw new Error(consentPayload?.error ?? "Unable to record interview consent.");
        }

        recordingChunksRef.current = [];
        await connectRealtime({ resume: false });
        lastInterviewerActivityAtRef.current = Date.now();
        lastPracticeNudgeAtRef.current = 0;
        const hasPriorProgress = transcriptRef.current.some((turn) => turn.speaker === "interviewer");
        if (!hasPriorProgress) {
          clearInterviewState(sessionId);
          timerStartedAtRef.current = Date.now();
          setRemainingSec(durationSec);
        } else if (timerStartedAtRef.current) {
          setRemainingSec(
            computeRemainingSec(durationSec, timerStartedAtRef.current, durationSec),
          );
        } else {
          timerStartedAtRef.current = Date.now();
          setRemainingSec(durationSec);
        }
        // Anchor server startedAt to the interview clock (not WebRTC connect time).
        void fetch(`/api/interview/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "LIVE", markStartedAt: true }),
        });
        // Start recording with the interview clock so blob length matches transcript timestamps.
        if (shouldRecordVideo && "MediaRecorder" in window && !mediaRecorderRef.current) {
          const recordingStream = setupRecordingStream();
          if (!recordingStream) {
            throw new Error("Unable to initialize interview recording.");
          }
          const recorder = MediaRecorder.isTypeSupported("video/webm")
            ? new MediaRecorder(recordingStream, { mimeType: "video/webm" })
            : new MediaRecorder(recordingStream);
          recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              recordingChunksRef.current.push(event.data);
            }
          };
          recorder.start(1000);
          mediaRecorderRef.current = recorder;
          setIsRecording(true);
        }
        setStage("live");
      } catch (startError) {
        pendingSessionGreetingRef.current = null;
        openingInterruptRestoreRef.current = false;
        setInterviewerStarting(false);
        cleanupConnectionRef.current();
        setStage("error");
        setError(
          startError instanceof Error
            ? startError.message
            : "Unable to start the realtime interview.",
        );
      }
    });
  };

  const statusCenter = useMemo(() => {
    if (stage === "connecting") return "Connecting to voice interviewer…";
    if (stage === "live") {
      if (visibilityBlocked && pauseReason) return formatInterviewPauseStatus(pauseReason);
      if (visibilityBlocked) return formatInterviewPauseStatus("face");
      if (interviewerStarting) return `${interviewerPanelLabel} starting…`;
      return formatLivePhaseStatus(livePhase, interviewerPanelLabel);
    }
    if (stage === "ending") return "Saving your interview…";
    if (stage === "post") return "Interview complete.";
    return "Check devices, then start the voice interview.";
  }, [interviewerPanelLabel, interviewerStarting, livePhase, pauseReason, stage, visibilityBlocked]);

  const liveTranscriptLines = useMemo(() => {
    void transcriptBump;
    return sortTranscriptTurns(transcriptRef.current)
      .slice(-8)
      .map((turn) => ({
        id: turn.id,
        speaker: turn.speaker === "interviewer" ? interviewerPanelLabel : "You",
        text: turn.text,
      }));
  }, [interviewerPanelLabel, transcriptBump]);

  const statusVisual = useMemo(
    () =>
      deriveInterviewStatusVisual({
        stage,
        visibilityBlocked,
        interviewerStarting,
        livePhase,
      }),
    [interviewerStarting, livePhase, stage, visibilityBlocked],
  );

  const { progressCurrent, progressPct, totalSteps } = useMemo(() => {
    void transcriptBump;
    const total = Math.max(mandatoryQuestions.length, 6);
    const aiTurns = transcriptRef.current.filter((t) => t.speaker === "interviewer").length;
    const current = Math.min(aiTurns, total);
    return {
      totalSteps: total,
      progressCurrent: current,
      progressPct: total > 0 ? Math.round((current / total) * 100) : 0,
    };
  }, [mandatoryQuestions.length, transcriptBump]);

  const formatClock = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const displayedRemainingSec = useMemo(
    () => resolveDisplayedRemainingSec(stage, durationSec, remainingSec),
    [durationSec, remainingSec, stage],
  );

  const recordingElapsedSec = useMemo(() => {
    if (stage !== "live" && stage !== "ending") return 0;
    if (!timerStartedAtRef.current) return 0;
    return Math.max(0, Math.min(durationSec, durationSec - remainingSec));
  }, [durationSec, remainingSec, stage]);

  if (stage === "post") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#eceef0] px-6 py-16">
        <div className="max-w-lg rounded-2xl bg-white p-10 text-center shadow-xl">
          <h2 className="text-2xl font-extrabold text-[#1d3557]">Thank you</h2>
          <p className="mt-3 text-sm text-slate-600">
            {sessionType === "COMPANY"
              ? "Your voice interview is complete. Your transcript and scorecard are saved for the hiring team."
              : "Your voice interview is complete. Your transcript and scorecard are saved."}
          </p>
          {videoUploadPending ? (
            <p className="mt-2 text-xs text-amber-700">
              Your video recording is still uploading. Please keep this tab open for a moment.
            </p>
          ) : null}
          <Link
            href="/"
            replace
            className="mt-8 inline-flex rounded-lg bg-[#1d3557] px-6 py-3 text-sm font-bold text-white"
          >
            Go to homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="interview-room flex min-h-[100dvh] flex-col bg-[#eef2f6] text-[#0f172a] dark:bg-background dark:text-foreground"
      style={sessionType === "COMPANY" ? (brandingCssVars as CSSProperties) : undefined}
    >
      <header className="flex h-[4.25rem] shrink-0 items-center justify-between border-b border-[#1d3557]/10 bg-white/85 px-4 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl sm:px-6 dark:border-border dark:bg-card/90">
        <div className="flex min-w-0 items-center gap-3">
          {brandLogoUrl && sessionType === "COMPANY" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brandLogoUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-lg object-contain ring-1 ring-[#1d3557]/10"
            />
          ) : null}
          <div className="min-w-0">
            <span
              className="font-display block truncate text-lg font-extrabold tracking-tight"
              style={headerBrandColor ? { color: headerBrandColor } : undefined}
            >
              {headerBrandLabel}
            </span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b] sm:block">
              Live interview room
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="rounded-full border border-[#1d3557]/10 bg-[#f8fafc] px-3 py-1.5 font-mono text-sm font-bold tabular-nums text-[#1d3557] dark:border-border dark:bg-surface dark:text-foreground">
            {formatClock(displayedRemainingSec)}
          </span>
          <button
            type="button"
            className="rounded-xl p-2.5 text-[#64748b] ring-1 ring-transparent transition hover:bg-[#f1f5f9] hover:text-[#1d3557] hover:ring-[#1d3557]/10"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="rounded-xl p-2.5 text-[#64748b] ring-1 ring-transparent transition hover:bg-[#f1f5f9] hover:text-[#1d3557] hover:ring-[#1d3557]/10"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[88rem] flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-5">
        {error ? (
          <p className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
        {stage === "ending" ? (
          <div className="shrink-0 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">
              {shouldRecordVideo
                ? "Saving your interview and recording. Please do not close this tab."
                : "Saving your interview. Please do not close this tab."}
            </p>
            <p className="mt-1 text-xs text-amber-800">
              {shouldRecordVideo
                ? "This usually takes under 15 seconds. Your video recording will finish uploading in the background after you see the thank-you screen."
                : "This usually takes under 15 seconds. Detailed answer scoring continues in the background for the hiring team."}
            </p>
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
          <div className="relative min-h-[220px] overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b1c33] via-[#16324f] to-[#1d4a6e] shadow-[0_16px_40px_rgba(15,23,42,0.18)] ring-1 ring-white/10 lg:min-h-[300px]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(14,116,144,0.28),transparent_45%)]" />
            <div className="absolute inset-0 opacity-40 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:28px_28px]" />
            <div className="relative flex h-full min-h-[220px] flex-col items-center justify-center px-6 text-center lg:min-h-[300px]">
              <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 shadow-[0_0_40px_rgba(14,116,144,0.35)]">
                {statusVisual.showSpinner ? (
                  <LoaderCircle className="h-8 w-8 animate-spin text-white/90" />
                ) : (
                  <Mic
                    className={`h-8 w-8 text-white/90 ${statusVisual.pulse ? "animate-pulse" : ""}`}
                  />
                )}
              </div>
              <p className="mt-5 max-w-sm text-sm font-semibold leading-relaxed text-white/90">
                {statusCenter}
              </p>
            </div>
            <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  livePhase === "speaking" ? "animate-pulse bg-emerald-400" : "bg-white/50"
                }`}
              />
              <span className="leading-tight">{interviewerPanelLabel}</span>
            </div>
          </div>

          <div className="relative min-h-[220px] overflow-hidden rounded-2xl bg-[#0f172a] shadow-[0_16px_40px_rgba(15,23,42,0.18)] ring-1 ring-[#1d3557]/15 lg:min-h-[300px]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full scale-x-[-1] object-cover"
            />
            {!permissionReady ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0f172a]/70 px-6 text-center backdrop-blur-[2px]">
                <Video className="h-8 w-8 text-white/70" />
                <p className="text-sm font-semibold text-white/90">Camera preview after device check</p>
              </div>
            ) : null}
            {stage === "live" && visibilityBlocked ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-900/80 px-6 text-center backdrop-blur-sm">
                {pauseReason === "mic" ? (
                  <MicOff className="h-10 w-10 text-amber-300" />
                ) : (
                  <VideoOff className="h-10 w-10 text-amber-300" />
                )}
                <p className="text-base font-bold text-white">
                  {getInterviewPauseOverlay(pauseReason ?? "face").title}
                </p>
                <p className="max-w-xs text-sm text-slate-200">
                  {getInterviewPauseOverlay(pauseReason ?? "face").body}
                </p>
              </div>
            ) : null}
            <div className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
              <User className="h-3.5 w-3.5" />
              You
            </div>
            <div className="absolute right-4 top-4 rounded-xl border border-white/20 bg-white/15 p-2 backdrop-blur-md">
              <Signal className="h-4 w-4 text-emerald-300" />
            </div>
            {shouldRecordVideo && isRecording ? (
              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600/95 px-3 py-1 text-xs font-bold text-white shadow-lg">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                REC {formatClock(recordingElapsedSec)}
              </div>
            ) : null}
          </div>
        </div>

        {stage === "preflight" || stage === "error" ? (
          <div className="flex shrink-0 flex-col gap-3 rounded-2xl border border-[#1d3557]/10 bg-white/90 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] backdrop-blur-sm sm:p-5">
            {!initialConsentAcceptedAt ? (
              <label className="flex items-start gap-3 rounded-xl border border-[#1d3557]/8 bg-[#f8fafc] px-4 py-3 text-sm text-[#334155]">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-[#1d3557] focus:ring-[#1d3557]/20"
                  checked={consentChecked}
                  onChange={(event) => setConsentChecked(event.target.checked)}
                />
                <span>
                  {INTERVIEW_CONSENT_SUMMARY}{" "}
                  <Link href="/terms" className="font-semibold text-[#1d3557] hover:underline">
                    Terms
                  </Link>
                  {" · "}
                  <Link href="/privacy" className="font-semibold text-[#1d3557] hover:underline">
                    Privacy
                  </Link>
                </span>
              </label>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handlePreflight()}
                className="rounded-xl border border-[#1d3557]/15 bg-white px-4 py-2.5 text-sm font-bold text-[#1d3557] shadow-sm transition hover:bg-[#f8fafc]"
              >
                Check camera &amp; mic
              </button>
              <button
                type="button"
                onClick={startInterview}
                disabled={!permissionReady || !camOn || isStarting || !consentChecked}
                title={
                  !consentChecked
                    ? "Accept the privacy terms to start"
                    : !camOn
                      ? "Turn on your camera to start the interview"
                      : undefined
                }
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0e7490] to-[#1d3557] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(29,53,87,0.28)] transition hover:brightness-105 disabled:opacity-50"
              >
                {isStarting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Connecting…
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" />
                    Start voice interview
                  </>
                )}
              </button>
            </div>
            {permissionReady && !camOn ? (
              <p className="text-xs font-semibold text-red-600">
                Camera is off. Turn on your camera below to start the interview.
              </p>
            ) : null}
          </div>
        ) : null}

        {showLiveTranscript && (stage === "live" || stage === "connecting" || stage === "ending") ? (
          <div className="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Live transcript
              </p>
              {livePhase === "processing" ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                  <LoaderCircle className="h-3 w-3 animate-spin" />
                  Processing audio…
                </span>
              ) : null}
            </div>
            <div className="max-h-36 space-y-2 overflow-y-auto text-sm">
              {liveTranscriptLines.length === 0 && !liveInterviewerPartial ? (
                <p className="text-slate-500">Transcript will appear here as you speak.</p>
              ) : null}
              {liveTranscriptLines.map((line) => (
                <p key={line.id} className="leading-snug text-slate-700">
                  <span className="font-bold text-[#1d3557]">{line.speaker}:</span> {line.text}
                </p>
              ))}
              {liveInterviewerPartial ? (
                <p className="leading-snug text-slate-600">
                  <span className="font-bold text-[#1d3557]">{interviewerPanelLabel}:</span>{" "}
                  {liveInterviewerPartial}
                  <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-[#006a62]" />
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#1d3557]/10 bg-white/95 px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] backdrop-blur-sm md:px-6">
          <div className="flex items-center gap-2 md:gap-3">
            <button
              type="button"
              onClick={() => setCamOn((c) => !c)}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition ${
                camOn ? "bg-[#0e7490]/10 text-[#0e7490]" : "text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1d3557]"
              }`}
            >
              {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              <span className="text-[10px] font-bold uppercase tracking-tight">Camera</span>
            </button>
            <button
              type="button"
              onClick={() => setMicOn((m) => !m)}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition ${
                micOn ? "bg-[#0e7490]/10 text-[#0e7490]" : "text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1d3557]"
              }`}
            >
              {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              <span className="text-[10px] font-bold uppercase tracking-tight">Mic</span>
            </button>
            <button
              type="button"
              onClick={() => setShowLiveTranscript((open) => !open)}
              aria-pressed={showLiveTranscript}
              title="Show live speech-to-text transcript"
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition ${
                showLiveTranscript
                  ? "bg-[#0e7490]/10 text-[#0e7490]"
                  : "text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#1d3557]"
              }`}
            >
              <Captions className="h-5 w-5" />
              <span className="text-[10px] font-bold uppercase tracking-tight">Transcript</span>
            </button>
          </div>

          <div className="hidden min-w-0 flex-1 justify-center sm:flex">
            <div
              className={`flex max-w-md items-center gap-3 rounded-full border px-5 py-2.5 ${
                statusVisual.tone === "processing"
                  ? "border-amber-200 bg-amber-50"
                  : statusVisual.tone === "connecting"
                    ? "border-slate-200 bg-slate-50"
                    : statusVisual.tone === "thinking"
                      ? "border-violet-200 bg-violet-50"
                      : statusVisual.tone === "speaking"
                        ? "border-sky-200 bg-sky-50"
                        : statusVisual.tone === "you-speaking"
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-[#0e7490]/20 bg-[#0e7490]/10"
              }`}
            >
              {statusVisual.showSpinner ? (
                <LoaderCircle
                  className={`h-4 w-4 shrink-0 animate-spin ${
                    statusVisual.tone === "thinking"
                      ? "text-violet-700"
                      : statusVisual.tone === "connecting"
                        ? "text-slate-600"
                        : "text-amber-700"
                  }`}
                />
              ) : statusVisual.pulse ? (
                <div className="flex gap-1">
                  <span
                    className={`h-4 w-1 animate-bounce rounded-full ${
                      statusVisual.tone === "you-speaking" ? "bg-emerald-700" : "bg-[#0e7490]"
                    }`}
                  />
                  <span
                    className={`h-6 w-1 animate-bounce rounded-full ${
                      statusVisual.tone === "you-speaking" ? "bg-emerald-700" : "bg-[#0e7490]"
                    }`}
                    style={{ animationDelay: "0.1s" }}
                  />
                  <span
                    className={`h-5 w-1 animate-bounce rounded-full ${
                      statusVisual.tone === "you-speaking" ? "bg-emerald-700" : "bg-[#0e7490]"
                    }`}
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
              ) : null}
              <span
                className={`truncate text-sm font-bold ${
                  statusVisual.tone === "processing"
                    ? "text-amber-800"
                    : statusVisual.tone === "connecting"
                      ? "text-slate-700"
                      : statusVisual.tone === "thinking"
                        ? "text-violet-800"
                        : statusVisual.tone === "speaking"
                          ? "text-sky-800"
                          : statusVisual.tone === "you-speaking"
                            ? "text-emerald-800"
                            : "text-[#0f766e]"
                }`}
              >
                {statusCenter}
              </span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3 md:gap-4">
            <div className="hidden flex-col items-end md:flex">
              <div className="mb-1 flex w-32 justify-between text-[10px] font-bold text-[#64748b]">
                <span>Progress</span>
                <span>
                  {progressCurrent} of {totalSteps}
                </span>
              </div>
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-[#e2e8f0]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0e7490] to-[#1d3557] transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => void finishInterview("manual")}
              disabled={stage !== "live" && stage !== "connecting"}
              className="whitespace-nowrap rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-40"
            >
              <span className="inline-flex items-center gap-2">
                <PhoneOff className="h-4 w-4" />
                End Interview
              </span>
            </button>
          </div>
        </div>

        <div className="flex justify-center sm:hidden">
          <div className="flex max-w-md items-center justify-center gap-2 px-2 text-center">
            {statusVisual.showSpinner ? (
              <LoaderCircle
                className={`h-3.5 w-3.5 shrink-0 animate-spin ${
                  statusVisual.tone === "thinking"
                    ? "text-violet-700"
                    : statusVisual.tone === "connecting"
                      ? "text-slate-600"
                      : "text-amber-700"
                }`}
              />
            ) : statusVisual.pulse ? (
              <div className="flex gap-0.5">
                <span
                  className={`h-3 w-0.5 animate-bounce rounded-full ${
                    statusVisual.tone === "you-speaking" ? "bg-emerald-700" : "bg-[#006a62]"
                  }`}
                />
                <span
                  className={`h-4 w-0.5 animate-bounce rounded-full ${
                    statusVisual.tone === "you-speaking" ? "bg-emerald-700" : "bg-[#006a62]"
                  }`}
                  style={{ animationDelay: "0.1s" }}
                />
                <span
                  className={`h-3.5 w-0.5 animate-bounce rounded-full ${
                    statusVisual.tone === "you-speaking" ? "bg-emerald-700" : "bg-[#006a62]"
                  }`}
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
            ) : null}
            <p className="text-xs font-bold text-[#006a62]">{statusCenter}</p>
          </div>
        </div>
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-white py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 md:flex-row">
          <span>© 2024 Uhired. All rights reserved.</span>
          <div className="flex gap-6">
            <a
              href="/privacy"
              className="cursor-pointer hover:text-[#1d3557] no-underline"
            >
              Privacy
            </a>
            <span className="cursor-pointer hover:text-[#1d3557]">Support</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
