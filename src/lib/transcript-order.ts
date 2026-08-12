export type TranscriptTurnInput = {
  id: string;
  speaker: "interviewer" | "candidate";
  text: string;
  timestampMs: number;
  /** Monotonic capture order — primary sort key when present. */
  orderIndex?: number;
  /** ASR confidence 0–1 when available (candidate turns from Whisper/ASR). */
  confidence?: number | null;
};

export type TranscriptPayloadItem = {
  speaker: "interviewer" | "candidate";
  text: string;
  orderIndex: number;
  timestampMs: number;
  confidence?: number | null;
};

/**
 * Sort by speech-start sequence (`orderIndex`), not transcription arrival time.
 * Turns arrive from three async realtime sources (interviewer done, candidate done,
 * speech/response start); only capture order reflects the true timeline.
 */
export function sortTranscriptTurns<
  T extends { timestampMs: number; id: string; orderIndex?: number },
>(turns: T[]): T[] {
  return [...turns].sort((a, b) => {
    const aOrder = a.orderIndex;
    const bOrder = b.orderIndex;
    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
    if (aOrder !== undefined) return -1;
    if (bOrder !== undefined) return 1;
    if (a.timestampMs !== b.timestampMs) return a.timestampMs - b.timestampMs;
    return a.id.localeCompare(b.id);
  });
}

export function buildTranscriptPayload(turns: TranscriptTurnInput[]): TranscriptPayloadItem[] {
  return sortTranscriptTurns(turns)
    .map((turn) => ({
      speaker: turn.speaker,
      text: turn.text.trim(),
      orderIndex: turn.orderIndex ?? 0,
      timestampMs: turn.timestampMs,
      confidence: turn.confidence ?? null,
    }))
    .filter((turn) => turn.text.length > 0)
    .map((turn, index) => ({
      speaker: turn.speaker,
      text: turn.text,
      orderIndex: turn.orderIndex ?? index,
      timestampMs: turn.timestampMs,
      confidence: turn.confidence ?? null,
    }));
}
