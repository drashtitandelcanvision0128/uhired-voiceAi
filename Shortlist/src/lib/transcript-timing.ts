export type TranscriptTimingTurn = {
  id: string;
  speaker: string;
  message: string;
  orderIndex: number;
  timestampMs: number | null;
};

export type TranscriptTimingIssue = "shuffle" | "overlap" | "missing_timestamp";

export type AnnotatedTranscriptTurn = TranscriptTimingTurn & {
  issues: TranscriptTimingIssue[];
  /** Position when sorted by orderIndex (display order). */
  displayIndex: number;
  /** Position when sorted by timestampMs; null if timestamp missing. */
  chronologyIndex: number | null;
};

export function formatTranscriptTimestampMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function sortByOrderIndex<T extends { orderIndex: number; id: string }>(turns: T[]): T[] {
  return [...turns].sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
    return a.id.localeCompare(b.id);
  });
}

function sortByTimestamp<T extends { timestampMs: number | null; id: string }>(turns: T[]): T[] {
  return [...turns]
    .filter((turn): turn is T & { timestampMs: number } => turn.timestampMs != null)
    .sort((a, b) => {
      if (a.timestampMs !== b.timestampMs) return a.timestampMs - b.timestampMs;
      return a.id.localeCompare(b.id);
    });
}

/**
 * Flags turns whose display order (orderIndex) disagrees with speech-start time,
 * or where consecutive display turns have non-monotonic timestamps (overlap/shuffle).
 */
export function annotateTranscriptTiming(turns: TranscriptTimingTurn[]): AnnotatedTranscriptTurn[] {
  const byOrder = sortByOrderIndex(turns);
  const byTime = sortByTimestamp(turns);
  const chronologyRank = new Map(byTime.map((turn, index) => [turn.id, index]));

  return byOrder.map((turn, displayIndex) => {
    const issues = new Set<TranscriptTimingIssue>();
    const chronologyIndex = chronologyRank.get(turn.id) ?? null;

    if (turn.timestampMs == null) {
      issues.add("missing_timestamp");
    }

    if (chronologyIndex != null && chronologyIndex !== displayIndex) {
      issues.add("shuffle");
    }

    if (displayIndex > 0 && turn.timestampMs != null) {
      const prev = byOrder[displayIndex - 1];
      if (prev.timestampMs != null && turn.timestampMs < prev.timestampMs) {
        issues.add("overlap");
      }
    }

    return {
      ...turn,
      displayIndex,
      chronologyIndex,
      issues: [...issues],
    };
  });
}

export function summarizeTranscriptTimingIssues(turns: AnnotatedTranscriptTurn[]): {
  shuffleCount: number;
  overlapCount: number;
  missingTimestampCount: number;
} {
  let shuffleCount = 0;
  let overlapCount = 0;
  let missingTimestampCount = 0;
  for (const turn of turns) {
    if (turn.issues.includes("shuffle")) shuffleCount += 1;
    if (turn.issues.includes("overlap")) overlapCount += 1;
    if (turn.issues.includes("missing_timestamp")) missingTimestampCount += 1;
  }
  return { shuffleCount, overlapCount, missingTimestampCount };
}

export function issueLabel(issue: TranscriptTimingIssue): string {
  switch (issue) {
    case "shuffle":
      return "Order mismatch";
    case "overlap":
      return "Timestamp overlap";
    case "missing_timestamp":
      return "No timestamp";
  }
}
