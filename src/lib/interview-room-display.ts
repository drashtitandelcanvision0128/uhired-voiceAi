import type { InterviewLivePhase } from "@/lib/interview-live-phase";

export type InterviewRoomStage =
  | "preflight"
  | "connecting"
  | "live"
  | "ending"
  | "post"
  | "error";

export type AvatarState = "idle" | "speaking" | "listening" | "thinking";

export type StatusVisualTone =
  | "idle"
  | "connecting"
  | "listening"
  | "you-speaking"
  | "speaking"
  | "thinking"
  | "processing";

export type StatusVisual = {
  pulse: boolean;
  showSpinner: boolean;
  tone: StatusVisualTone;
};

export type InterviewPauseReason = "camera" | "mic" | "face";

export type InterviewPauseOverlay = {
  title: string;
  body: string;
};

export function formatInterviewPauseStatus(reason: InterviewPauseReason): string {
  switch (reason) {
    case "camera":
      return "Paused — please turn your camera back on";
    case "mic":
      return "Paused — please turn your microphone back on";
    case "face":
      return "Paused — please stay visible on camera";
  }
}

export function getInterviewPauseOverlay(reason: InterviewPauseReason): InterviewPauseOverlay {
  switch (reason) {
    case "camera":
      return {
        title: "Interview paused",
        body: "Your camera is off. Turn it back on below — the interview resumes automatically once we can see you.",
      };
    case "mic":
      return {
        title: "Interview paused",
        body: "Your microphone is muted. Turn it back on below — the interview resumes automatically once we can hear you.",
      };
    case "face":
      return {
        title: "Interview paused",
        body: "We can't detect your face. Please face the camera and remove anything covering it. The interview resumes automatically once you're visible.",
      };
  }
}

type AvatarStateInput = {
  interviewerStarting: boolean;
  livePhase: InterviewLivePhase;
};

type StatusVisualInput = {
  stage: InterviewRoomStage;
  visibilityBlocked: boolean;
  interviewerStarting: boolean;
  livePhase: InterviewLivePhase;
};

/** Map realtime phase signals to the animated avatar state. */
export function deriveInterviewerAvatarState(input: AvatarStateInput): AvatarState {
  if (
    input.interviewerStarting ||
    input.livePhase === "thinking" ||
    input.livePhase === "processing"
  ) {
    return "thinking";
  }
  if (input.livePhase === "speaking") return "speaking";
  if (input.livePhase === "listening" || input.livePhase === "you-speaking") {
    return "listening";
  }
  return "idle";
}

/** Map interview stage + live phase to status-bar visuals (spinner vs speaking bars). */
export function deriveInterviewStatusVisual(input: StatusVisualInput): StatusVisual {
  if (input.stage === "connecting" || input.stage === "ending") {
    return {
      pulse: false,
      showSpinner: true,
      tone: input.stage === "ending" ? "processing" : "connecting",
    };
  }

  if (input.stage !== "live" || input.visibilityBlocked) {
    return { pulse: false, showSpinner: false, tone: "idle" };
  }

  if (input.interviewerStarting) {
    return { pulse: false, showSpinner: true, tone: "thinking" };
  }

  if (input.livePhase === "processing" || input.livePhase === "thinking") {
    return { pulse: false, showSpinner: true, tone: input.livePhase };
  }

  if (input.livePhase === "speaking" || input.livePhase === "you-speaking") {
    return { pulse: true, showSpinner: false, tone: input.livePhase };
  }

  return { pulse: true, showSpinner: false, tone: "listening" };
}
