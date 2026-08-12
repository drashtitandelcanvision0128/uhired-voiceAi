/** Minimum ASR confidence (0–1) required before a candidate answer is evaluated. */
export const DEFAULT_TRANSCRIPTION_CONFIDENCE_THRESHOLD = 0.5;

/** Max low-confidence retries per question before escalating the repeat prompt. */
export const DEFAULT_TRANSCRIPTION_CONFIDENCE_MAX_RETRIES = 3;

export type TranscriptConfidenceConfig = {
  threshold: number;
  maxRetries: number;
};

export type TranscriptConfidenceRejectReason =
  | "below_threshold"
  | "empty_or_noise";

export type TranscriptConfidenceAcceptReason =
  | "above_threshold"
  | "no_confidence_data";

export type TranscriptConfidenceValidation =
  | {
      accepted: true;
      reason: TranscriptConfidenceAcceptReason;
      confidence: number | null;
      threshold: number;
      retryCount: number;
    }
  | {
      accepted: false;
      reason: TranscriptConfidenceRejectReason;
      confidence: number | null;
      threshold: number;
      retryCount: number;
      shouldRetry: boolean;
    };

function readEnvNumber(
  env: Record<string, string | undefined>,
  keys: string[],
  fallback: number,
  bounds?: { min?: number; max?: number },
): number {
  for (const key of keys) {
    const raw = env[key]?.trim();
    if (!raw) continue;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) continue;
    let value = parsed;
    if (bounds?.min != null) value = Math.max(bounds.min, value);
    if (bounds?.max != null) value = Math.min(bounds.max, value);
    return value;
  }
  return fallback;
}

/** Resolve transcript confidence thresholds from environment variables. */
export function resolveTranscriptConfidenceConfig(
  env: Record<string, string | undefined> = typeof process !== "undefined"
    ? (process.env as Record<string, string | undefined>)
    : {},
): TranscriptConfidenceConfig {
  return {
    threshold: readEnvNumber(
      env,
      [
        "NEXT_PUBLIC_TRANSCRIPTION_CONFIDENCE_THRESHOLD",
        "TRANSCRIPTION_CONFIDENCE_THRESHOLD",
      ],
      DEFAULT_TRANSCRIPTION_CONFIDENCE_THRESHOLD,
      { min: 0.1, max: 0.95 },
    ),
    maxRetries: readEnvNumber(
      env,
      [
        "NEXT_PUBLIC_TRANSCRIPTION_CONFIDENCE_MAX_RETRIES",
        "TRANSCRIPTION_CONFIDENCE_MAX_RETRIES",
      ],
      DEFAULT_TRANSCRIPTION_CONFIDENCE_MAX_RETRIES,
      { min: 1, max: 10 },
    ),
  };
}

export type ValidateTranscriptConfidenceInput = {
  text: string;
  confidence: number | null;
  rejectedAsNoise: boolean;
  /** Low-confidence retries already used for the current question. */
  retryCount: number;
  config?: TranscriptConfidenceConfig;
};

/**
 * Decide whether a finalized candidate transcript is reliable enough to evaluate.
 * Returns accepted=false for noise/empty (caller should use the silence path) and
 * for substantive text below the confidence threshold.
 */
export function validateTranscriptConfidence(
  input: ValidateTranscriptConfidenceInput,
): TranscriptConfidenceValidation {
  const config = input.config ?? resolveTranscriptConfidenceConfig();
  const trimmed = input.text.trim();
  const base = {
    confidence: input.confidence,
    threshold: config.threshold,
    retryCount: input.retryCount,
  };

  if (input.rejectedAsNoise || !trimmed) {
    return { accepted: false, reason: "empty_or_noise", ...base, shouldRetry: false };
  }

  if (input.confidence === null) {
    return { accepted: true, reason: "no_confidence_data", ...base };
  }

  if (input.confidence >= config.threshold) {
    return { accepted: true, reason: "above_threshold", ...base };
  }

  return {
    accepted: false,
    reason: "below_threshold",
    ...base,
    shouldRetry: input.retryCount < config.maxRetries,
  };
}

export type TranscriptConfidenceLogEntry = {
  utteranceGen: number;
  itemId?: string;
  confidence: number | null;
  threshold: number;
  retryCount: number;
  accepted: boolean;
  reason: string;
  textPreview: string;
  shouldRetry?: boolean;
};

/** Structured log for monitoring ASR confidence in production. */
export function logTranscriptConfidence(entry: TranscriptConfidenceLogEntry): void {
  const payload = {
    ...entry,
    textPreview: entry.textPreview.slice(0, 120),
  };
  if (entry.accepted) {
    console.info("[TranscriptConfidence]", payload);
  } else if (entry.reason === "below_threshold") {
    console.warn("[TranscriptConfidence] rejected", payload);
  } else {
    console.info("[TranscriptConfidence] skipped", payload);
  }
}
