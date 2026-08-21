/**
 * Scoring trust helpers — help recruiters interpret AI vs heuristic scores.
 */

export const SCORING_FAIRNESS_NOTE =
  "Scores combine communication, domain depth, and confidence signals from the transcript. Short or incomplete answers often lower scores. AI rubric grading may refine an initial heuristic estimate — treat scores as decision support, not a sole hiring verdict.";

export function isHeuristicScoringMode(scoringMode: string | null | undefined): boolean {
  const mode = (scoringMode ?? "").toLowerCase();
  return !mode || mode.includes("heuristic");
}

export function describeScoringMode(scoringMode: string | null | undefined): string {
  const mode = (scoringMode ?? "heuristic").trim();
  if (isHeuristicScoringMode(mode)) {
    return "Initial / heuristic estimate (AI rubric may still be pending)";
  }
  if (mode.includes("ai") || mode.includes("rubric")) {
    return "AI rubric scoring";
  }
  return mode;
}

export type ThinTranscriptAssessment = {
  thin: boolean;
  turnCount: number;
  candidateChars: number;
  warning: string | null;
};

export function assessTranscriptThinness(
  turns: Array<{ speaker: string; message: string }>,
): ThinTranscriptAssessment {
  const candidateTurns = turns.filter((t) => t.speaker.toUpperCase() === "CANDIDATE");
  const candidateChars = candidateTurns.reduce((sum, t) => sum + t.message.trim().length, 0);
  const turnCount = turns.length;
  const thin = turnCount < 4 || candidateChars < 80;
  return {
    thin,
    turnCount,
    candidateChars,
    warning: thin
      ? "Transcript is thin (few candidate answers). Scores may be low or unreliable — consider a re-interview if the call dropped early."
      : null,
  };
}
