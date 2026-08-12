export function computeRemainingSec(
  durationSec: number,
  timerStartedAt: number | null,
  fallbackRemainingSec: number,
  nowMs: number = Date.now(),
): number {
  if (!timerStartedAt) return fallbackRemainingSec;
  const elapsedSec = Math.floor((nowMs - timerStartedAt) / 1000);
  return Math.max(0, durationSec - elapsedSec);
}

/** Header/controls should not show elapsed time until the interview is actually live. */
export function resolveDisplayedRemainingSec(
  stage: string,
  durationSec: number,
  remainingSec: number,
): number {
  if (stage === "live" || stage === "ending") return remainingSec;
  return durationSec;
}

/**
 * Whether saved session storage should restore a running timer.
 * Connecting snapshots only restore when the interview had actually started (interviewer spoke).
 */
export function shouldRestoreInterviewTimer(
  savedStage: string,
  hasInterviewerProgress: boolean,
  timerStartedAt: number | null,
): boolean {
  if (savedStage === "live") return true;
  return (
    savedStage === "connecting" &&
    hasInterviewerProgress &&
    timerStartedAt != null
  );
}
