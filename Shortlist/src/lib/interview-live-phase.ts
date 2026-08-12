export type InterviewLivePhase =
  | "listening"
  | "you-speaking"
  | "processing"
  | "thinking"
  | "speaking";

export type LivePhaseInputs = {
  aiAudioActive: boolean;
  responseInFlight: boolean;
  candidateSpeechActive: boolean;
  unsettledCandidateUtterances: number;
  responseDelayPending: boolean;
};

/** Derive the visible interview audio phase from realtime connection signals. */
export function deriveInterviewLivePhase(input: LivePhaseInputs): InterviewLivePhase {
  if (input.aiAudioActive) return "speaking";
  if (input.responseInFlight) return "thinking";
  if (input.candidateSpeechActive) return "you-speaking";
  if (input.unsettledCandidateUtterances > 0 || input.responseDelayPending) {
    return "processing";
  }
  return "listening";
}

export function formatLivePhaseStatus(
  phase: InterviewLivePhase,
  interviewerLabel: string,
): string {
  switch (phase) {
    case "speaking":
      return `${interviewerLabel} speaking…`;
    case "thinking":
      return `${interviewerLabel} is thinking…`;
    case "processing":
      return "Processing your response…";
    case "you-speaking":
      return "You're speaking…";
    default:
      return "Listening for your response…";
  }
}
