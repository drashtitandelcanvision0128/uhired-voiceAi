/** Target transition latency from candidate speech end to interviewer audio start. */
export const TURN_LATENCY_TARGET_MS = 1_000;

export type TurnMilestone =
  | "speech_stopped"
  | "transcript_received"
  | "instructions_ready"
  | "response_create_sent"
  | "first_audio_delta"
  | "interviewer_transcript_done";

export type TurnPerformanceRecord = {
  utteranceGen: number;
  milestones: Partial<Record<TurnMilestone, number>>;
  evaluationStatus?: string;
  sessionPhase?: string;
  advanced?: boolean;
};

function formatMs(ms: number | undefined): string {
  return ms == null ? "—" : `${ms}ms`;
}

function deltaMs(
  milestones: Partial<Record<TurnMilestone, number>>,
  from: TurnMilestone,
  to: TurnMilestone,
): number | null {
  const start = milestones[from];
  const end = milestones[to];
  if (start == null || end == null) return null;
  return Math.max(0, end - start);
}

/**
 * Tracks per-utterance latency from candidate speech end through interviewer response.
 * Logs structured summaries for production monitoring.
 */
export class InterviewTurnPerformanceTracker {
  private active = new Map<number, TurnPerformanceRecord>();
  private completed: TurnPerformanceRecord[] = [];
  private readonly maxCompleted = 50;

  startTurn(utteranceGen: number): void {
    this.active.set(utteranceGen, { utteranceGen, milestones: {} });
  }

  mark(
    utteranceGen: number,
    milestone: TurnMilestone,
    meta?: Pick<TurnPerformanceRecord, "evaluationStatus" | "sessionPhase" | "advanced">,
  ): void {
    const record = this.active.get(utteranceGen);
    if (!record || record.milestones[milestone] != null) return;
    record.milestones[milestone] = Date.now();
    if (meta) Object.assign(record, meta);
  }

  finishTurn(utteranceGen: number): TurnPerformanceRecord | null {
    const record = this.active.get(utteranceGen);
    if (!record) return null;
    this.active.delete(utteranceGen);
    this.completed.push(record);
    if (this.completed.length > this.maxCompleted) {
      this.completed.shift();
    }
    this.logTurn(record);
    return record;
  }

  getSummary(utteranceGen: number): {
    speechToResponseMs: number | null;
    speechToAudioMs: number | null;
    withinTarget: boolean | null;
  } {
    const record = this.active.get(utteranceGen) ?? this.completed.find((r) => r.utteranceGen === utteranceGen);
    if (!record) {
      return { speechToResponseMs: null, speechToAudioMs: null, withinTarget: null };
    }
    const speechToResponseMs = deltaMs(record.milestones, "speech_stopped", "response_create_sent");
    const speechToAudioMs = deltaMs(record.milestones, "speech_stopped", "first_audio_delta");
    const measured = speechToAudioMs ?? speechToResponseMs;
    return {
      speechToResponseMs,
      speechToAudioMs,
      withinTarget: measured == null ? null : measured <= TURN_LATENCY_TARGET_MS,
    };
  }

  private logTurn(record: TurnPerformanceRecord): void {
    const { milestones } = record;
    const speechToTranscript = deltaMs(milestones, "speech_stopped", "transcript_received");
    const speechToInstructions = deltaMs(milestones, "speech_stopped", "instructions_ready");
    const speechToResponse = deltaMs(milestones, "speech_stopped", "response_create_sent");
    const speechToAudio = deltaMs(milestones, "speech_stopped", "first_audio_delta");
    const responseToAudio = deltaMs(milestones, "response_create_sent", "first_audio_delta");
    const measured = speechToAudio ?? speechToResponse;
    const withinTarget = measured != null && measured <= TURN_LATENCY_TARGET_MS;

    const payload = {
      utteranceGen: record.utteranceGen,
      evaluationStatus: record.evaluationStatus,
      sessionPhase: record.sessionPhase,
      advanced: record.advanced,
      latencies: {
        speechToTranscript: formatMs(speechToTranscript ?? undefined),
        speechToInstructions: formatMs(speechToInstructions ?? undefined),
        speechToResponseCreate: formatMs(speechToResponse ?? undefined),
        speechToFirstAudio: formatMs(speechToAudio ?? undefined),
        responseCreateToFirstAudio: formatMs(responseToAudio ?? undefined),
      },
      withinTarget,
      targetMs: TURN_LATENCY_TARGET_MS,
    };

    if (withinTarget) {
      console.info("[InterviewTurnPerf]", payload);
    } else if (measured != null) {
      console.warn("[InterviewTurnPerf] slow transition", payload);
    } else {
      console.info("[InterviewTurnPerf] incomplete", payload);
    }
  }
}
