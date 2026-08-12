/**
 * Voice Activity Detection helpers for OpenAI Realtime server_vad plus client-side
 * validation to filter breathing, keyboard clicks, and distant background speech.
 */

export type VadSoundClass =
  | "silence"
  | "speech"
  | "breathing"
  | "keyboard"
  | "background";

export type VadConfig = {
  /** OpenAI server_vad activation threshold (0–1). */
  threshold: number;
  /** Audio included before detected speech start. */
  prefixPaddingMs: number;
  /** Default silence window before speech_stopped. */
  silenceBaseMs: number;
  /** Minimum dynamic silence duration. */
  silenceMinMs: number;
  /** Maximum dynamic silence duration (OpenAI cap: 10_000). */
  silenceMaxMs: number;
  /** Client-side confirmation window after server speech_started. */
  speechConfirmMs: number;
  /** Max duration for keyboard-click transients. */
  keyboardTransientMaxMs: number;
  /** RMS ceiling treated as breathing rather than speech. */
  breathingMaxRms: number;
  /** RMS floor required to accept near-field speech. */
  speechMinRms: number;
  /** Min speech-band energy ratio for near-field speech. */
  speechMinBandRatio: number;
  /** Max speech-band ratio for distant/background voices. */
  backgroundMaxBandRatio: number;
  /** Frames required to confirm speech after server VAD trigger. */
  speechConfirmFrames: number;
};

export type AudioFrameFeatures = {
  rms: number;
  speechBandRatio: number;
  highBandRatio: number;
  zeroCrossingRate: number;
  crestFactor: number;
  timestampMs: number;
};

export type DynamicSilenceContext = {
  utteranceDurationMs: number;
  midUtterancePauseCount: number;
  lastUtteranceWasSubstantive: boolean;
};

export type SpeechStartValidation = {
  accept: boolean;
  soundClass: VadSoundClass;
  reason: string;
};

const OPENAI_SILENCE_MAX_MS = 10_000;

const DEFAULT_VAD_CONFIG: VadConfig = {
  threshold: 0.6,
  prefixPaddingMs: 300,
  silenceBaseMs: 3_000,
  silenceMinMs: 2_000,
  silenceMaxMs: 5_000,
  speechConfirmMs: 160,
  keyboardTransientMaxMs: 90,
  breathingMaxRms: 0.028,
  speechMinRms: 0.04,
  speechMinBandRatio: 0.32,
  backgroundMaxBandRatio: 0.22,
  speechConfirmFrames: 3,
};

function readEnvNumber(
  env: Record<string, string | undefined>,
  keys: string[],
  fallback: number,
  { min, max }: { min?: number; max?: number } = {},
): number {
  for (const key of keys) {
    const raw = env[key]?.trim();
    if (!raw) continue;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) continue;
    let value = parsed;
    if (min != null) value = Math.max(min, value);
    if (max != null) value = Math.min(max, value);
    return value;
  }
  return fallback;
}

/** Resolve VAD thresholds from environment variables with stable production defaults. */
export function resolveVadConfig(
  env: Record<string, string | undefined> = typeof process !== "undefined"
    ? (process.env as Record<string, string | undefined>)
    : {},
): VadConfig {
  return {
    threshold: readEnvNumber(
      env,
      ["NEXT_PUBLIC_VAD_THRESHOLD", "VAD_THRESHOLD"],
      DEFAULT_VAD_CONFIG.threshold,
      { min: 0.1, max: 0.95 },
    ),
    prefixPaddingMs: readEnvNumber(
      env,
      ["NEXT_PUBLIC_VAD_PREFIX_PADDING_MS", "VAD_PREFIX_PADDING_MS"],
      DEFAULT_VAD_CONFIG.prefixPaddingMs,
      { min: 100, max: 1_000 },
    ),
    silenceBaseMs: readEnvNumber(
      env,
      ["NEXT_PUBLIC_VAD_SILENCE_BASE_MS", "VAD_SILENCE_BASE_MS"],
      DEFAULT_VAD_CONFIG.silenceBaseMs,
      { min: 500, max: OPENAI_SILENCE_MAX_MS },
    ),
    silenceMinMs: readEnvNumber(
      env,
      ["NEXT_PUBLIC_VAD_SILENCE_MIN_MS", "VAD_SILENCE_MIN_MS"],
      DEFAULT_VAD_CONFIG.silenceMinMs,
      { min: 500, max: OPENAI_SILENCE_MAX_MS },
    ),
    silenceMaxMs: readEnvNumber(
      env,
      ["NEXT_PUBLIC_VAD_SILENCE_MAX_MS", "VAD_SILENCE_MAX_MS"],
      DEFAULT_VAD_CONFIG.silenceMaxMs,
      { min: 1_000, max: OPENAI_SILENCE_MAX_MS },
    ),
    speechConfirmMs: readEnvNumber(
      env,
      ["NEXT_PUBLIC_VAD_SPEECH_CONFIRM_MS", "VAD_SPEECH_CONFIRM_MS"],
      DEFAULT_VAD_CONFIG.speechConfirmMs,
      { min: 80, max: 400 },
    ),
    keyboardTransientMaxMs: readEnvNumber(
      env,
      ["NEXT_PUBLIC_VAD_KEYBOARD_TRANSIENT_MAX_MS", "VAD_KEYBOARD_TRANSIENT_MAX_MS"],
      DEFAULT_VAD_CONFIG.keyboardTransientMaxMs,
      { min: 40, max: 200 },
    ),
    breathingMaxRms: readEnvNumber(
      env,
      ["NEXT_PUBLIC_VAD_BREATHING_MAX_RMS", "VAD_BREATHING_MAX_RMS"],
      DEFAULT_VAD_CONFIG.breathingMaxRms,
      { min: 0.005, max: 0.1 },
    ),
    speechMinRms: readEnvNumber(
      env,
      ["NEXT_PUBLIC_VAD_SPEECH_MIN_RMS", "VAD_SPEECH_MIN_RMS"],
      DEFAULT_VAD_CONFIG.speechMinRms,
      { min: 0.01, max: 0.2 },
    ),
    speechMinBandRatio: readEnvNumber(
      env,
      ["NEXT_PUBLIC_VAD_SPEECH_MIN_BAND_RATIO", "VAD_SPEECH_MIN_BAND_RATIO"],
      DEFAULT_VAD_CONFIG.speechMinBandRatio,
      { min: 0.1, max: 0.9 },
    ),
    backgroundMaxBandRatio: readEnvNumber(
      env,
      ["NEXT_PUBLIC_VAD_BACKGROUND_MAX_BAND_RATIO", "VAD_BACKGROUND_MAX_BAND_RATIO"],
      DEFAULT_VAD_CONFIG.backgroundMaxBandRatio,
      { min: 0.05, max: 0.5 },
    ),
    speechConfirmFrames: readEnvNumber(
      env,
      ["NEXT_PUBLIC_VAD_SPEECH_CONFIRM_FRAMES", "VAD_SPEECH_CONFIRM_FRAMES"],
      DEFAULT_VAD_CONFIG.speechConfirmFrames,
      { min: 1, max: 10 },
    ),
  };
}

export function clampSilenceDurationMs(config: VadConfig, value: number): number {
  const min = Math.min(config.silenceMinMs, config.silenceMaxMs);
  const max = Math.max(config.silenceMinMs, config.silenceMaxMs);
  return Math.round(Math.min(max, Math.max(min, value)));
}

/**
 * Tune silence timeout from recent utterance behavior — longer/thoughtful answers
 * receive more tail padding so the interviewer does not cut the candidate off.
 */
export function computeDynamicSilenceDurationMs(
  config: VadConfig,
  context: DynamicSilenceContext,
): number {
  let duration = config.silenceBaseMs;

  if (context.utteranceDurationMs > 30_000) {
    duration += 1_500;
  } else if (context.utteranceDurationMs > 15_000) {
    duration += 1_000;
  } else if (context.utteranceDurationMs > 8_000) {
    duration += 500;
  }

  duration += Math.min(context.midUtterancePauseCount * 350, 1_050);

  if (context.lastUtteranceWasSubstantive) {
    duration += 250;
  }

  return clampSilenceDurationMs(config, duration);
}

/** Classify a single analysed audio frame. */
export function classifyAudioFrame(
  frame: AudioFrameFeatures,
  config: VadConfig,
  noiseFloorRms: number,
): VadSoundClass {
  const effectiveFloor = Math.max(noiseFloorRms, 0.004);

  if (frame.rms <= effectiveFloor * 1.35) {
    return "silence";
  }

  const isKeyboardTransient =
    frame.crestFactor >= 4.2 &&
    frame.highBandRatio >= 0.34 &&
    frame.rms < config.speechMinRms * 1.8;

  if (isKeyboardTransient) {
    return "keyboard";
  }

  const isBreathing =
    frame.rms <= config.breathingMaxRms &&
    frame.speechBandRatio < config.speechMinBandRatio &&
    frame.zeroCrossingRate < 0.09;

  if (isBreathing) {
    return "breathing";
  }

  const isNearFieldSpeech =
    frame.rms >= config.speechMinRms &&
    frame.speechBandRatio >= config.speechMinBandRatio;

  if (isNearFieldSpeech) {
    return "speech";
  }

  const isBackground =
    frame.rms > effectiveFloor * 1.6 &&
    frame.speechBandRatio <= config.backgroundMaxBandRatio;

  if (isBackground) {
    return "background";
  }

  if (frame.rms >= config.speechMinRms * 0.85) {
    return "speech";
  }

  return "silence";
}

/** Decide whether to accept a server `speech_started` event based on recent mic frames. */
export function validateSpeechStart(
  frames: AudioFrameFeatures[],
  config: VadConfig,
  noiseFloorRms: number,
): SpeechStartValidation {
  if (frames.length === 0) {
    return { accept: true, soundClass: "speech", reason: "no_client_samples" };
  }

  const recent = frames.slice(-Math.max(config.speechConfirmFrames, 4));
  const classes = recent.map((frame) => classifyAudioFrame(frame, config, noiseFloorRms));
  const speechFrames = classes.filter((soundClass) => soundClass === "speech").length;
  const keyboardFrames = classes.filter((soundClass) => soundClass === "keyboard").length;
  const breathingFrames = classes.filter((soundClass) => soundClass === "breathing").length;
  const backgroundFrames = classes.filter((soundClass) => soundClass === "background").length;
  const silenceFrames = classes.filter((soundClass) => soundClass === "silence").length;

  const dominant = dominantSoundClass(classes);
  const peakRms = Math.max(...recent.map((frame) => frame.rms));
  const peakSpeechBand = Math.max(...recent.map((frame) => frame.speechBandRatio));

  if (keyboardFrames >= Math.ceil(recent.length * 0.5)) {
    return { accept: false, soundClass: "keyboard", reason: "keyboard_transient" };
  }

  if (breathingFrames >= Math.ceil(recent.length * 0.6)) {
    return { accept: false, soundClass: "breathing", reason: "breathing" };
  }

  if (backgroundFrames >= Math.ceil(recent.length * 0.55)) {
    return { accept: false, soundClass: "background", reason: "background_conversation" };
  }

  if (
    silenceFrames >= Math.ceil(recent.length * 0.7) &&
    peakRms < config.speechMinRms &&
    peakSpeechBand < config.speechMinBandRatio
  ) {
    return { accept: false, soundClass: "silence", reason: "silence" };
  }

  if (speechFrames >= config.speechConfirmFrames) {
    return { accept: true, soundClass: "speech", reason: "confirmed_speech" };
  }

  if (peakRms >= config.speechMinRms && peakSpeechBand >= config.speechMinBandRatio * 0.9) {
    return { accept: true, soundClass: "speech", reason: "near_field_energy" };
  }

  return {
    accept: false,
    soundClass: dominant,
    reason: `insufficient_speech_frames:${speechFrames}`,
  };
}

function dominantSoundClass(classes: VadSoundClass[]): VadSoundClass {
  const counts = new Map<VadSoundClass, number>();
  for (const soundClass of classes) {
    counts.set(soundClass, (counts.get(soundClass) ?? 0) + 1);
  }
  let best: VadSoundClass = "silence";
  let bestCount = -1;
  for (const [soundClass, count] of counts) {
    if (count > bestCount) {
      best = soundClass;
      bestCount = count;
    }
  }
  return best;
}

/** Build OpenAI Realtime `turn_detection` config for server_vad. */
export function buildServerVadTurnDetection(
  config: VadConfig = resolveVadConfig(),
  silenceDurationMs: number = config.silenceBaseMs,
) {
  return {
    type: "server_vad" as const,
    threshold: config.threshold,
    prefix_padding_ms: config.prefixPaddingMs,
    silence_duration_ms: clampSilenceDurationMs(config, silenceDurationMs),
  };
}

/** Derive analyser features from FFT magnitude bins (0–255). */
export function extractAudioFrameFeatures(
  frequencyData: Uint8Array,
  sampleRate: number,
  timestampMs: number,
  timeDomainData?: Uint8Array,
): AudioFrameFeatures {
  const binCount = frequencyData.length;
  const nyquist = sampleRate / 2;
  const binHz = nyquist / binCount;

  let total = 0;
  let speechBand = 0;
  let highBand = 0;

  for (let i = 0; i < binCount; i += 1) {
    const magnitude = frequencyData[i] / 255;
    total += magnitude;
    const hz = i * binHz;
    if (hz >= 300 && hz <= 3_400) {
      speechBand += magnitude;
    }
    if (hz >= 2_000) {
      highBand += magnitude;
    }
  }

  const rms = total > 0 ? Math.sqrt(total / binCount) : 0;
  const speechBandRatio = total > 0 ? speechBand / total : 0;
  const highBandRatio = total > 0 ? highBand / total : 0;

  let zeroCrossingRate = 0;
  let crestFactor = 1;
  if (timeDomainData && timeDomainData.length > 1) {
    let crossings = 0;
    let peak = 0;
    let sumSquares = 0;
    for (let i = 0; i < timeDomainData.length; i += 1) {
      const sample = (timeDomainData[i] - 128) / 128;
      sumSquares += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
      if (i > 0) {
        const prev = (timeDomainData[i - 1] - 128) / 128;
        if ((sample >= 0 && prev < 0) || (sample < 0 && prev >= 0)) {
          crossings += 1;
        }
      }
    }
    zeroCrossingRate = crossings / timeDomainData.length;
    const frameRms = Math.sqrt(sumSquares / timeDomainData.length);
    crestFactor = frameRms > 0 ? peak / frameRms : 1;
  }

  return {
    rms,
    speechBandRatio,
    highBandRatio,
    zeroCrossingRate,
    crestFactor,
    timestampMs,
  };
}

/** Update adaptive noise floor during non-speech periods. */
export function updateNoiseFloorRms(current: number, frameRms: number, alpha = 0.08): number {
  if (frameRms <= current * 1.5) {
    return current * (1 - alpha) + frameRms * alpha;
  }
  return current;
}

export function isShortKeyboardUtterance(
  durationMs: number,
  validation: SpeechStartValidation,
  config: VadConfig = resolveVadConfig(),
): boolean {
  return (
    durationMs <= config.keyboardTransientMaxMs &&
    (validation.soundClass === "keyboard" || validation.reason === "keyboard_transient")
  );
}
