type DurationInput = {
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
  durationMin: number;
  videoDurationSec?: number | null;
};

function toMs(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Human-readable interview length (actual interview clock when available). */
export function formatInterviewDuration(input: DurationInput): string {
  // Prefer client-reported recording/interview elapsed — wall-clock startedAt/endedAt
  // includes connect, Whisper drain, and upload and overstates the allocated slot.
  if (input.videoDurationSec != null && input.videoDurationSec > 0) {
    const totalSec = Math.round(input.videoDurationSec);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min < 1) return `${totalSec} sec`;
    return sec > 0 ? `${min} min ${sec} sec` : `${min} min`;
  }

  const started = toMs(input.startedAt);
  const ended = toMs(input.endedAt);
  if (started != null && ended != null && ended > started) {
    const totalSec = Math.round((ended - started) / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min < 1) return `${totalSec} sec`;
    return sec > 0 ? `${min} min ${sec} sec` : `${min} min`;
  }

  return `${input.durationMin} min (allocated)`;
}

export function formatInterviewDurationShort(input: DurationInput): string {
  const full = formatInterviewDuration(input);
  if (full.includes("(allocated)")) return `${input.durationMin} min`;
  return full;
}

/** Minutes reserved for greeting, self-intro, and closing remarks. */
export const INTERVIEW_OVERHEAD_MIN = 3;

/** Average minutes per substantive question cycle (question + answer + brief follow-up). */
export const INTERVIEW_MINUTES_PER_QUESTION = 3;

/** Hard cap on mandatory questions stored per requirement/session. */
export const MAX_MANDATORY_QUESTIONS = 5;

/**
 * Scale mandatory question count with interview length (~3 min overhead, ~3 min per Q&A).
 * 5 min → 1, 10 min → 2, 15 min → 4, 20 min → 5.
 */
export function computeMandatoryQuestionCount(durationMin: number): number {
  const minutes = Math.max(5, Math.floor(durationMin));
  const available = minutes - INTERVIEW_OVERHEAD_MIN;
  if (available <= 0) return 1;
  return Math.min(
    MAX_MANDATORY_QUESTIONS,
    Math.max(1, Math.floor(available / INTERVIEW_MINUTES_PER_QUESTION)),
  );
}
