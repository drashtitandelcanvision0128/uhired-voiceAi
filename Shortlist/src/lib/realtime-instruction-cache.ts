import { getCachedPrompt, stableSerialize } from "@/lib/interview-prompt-cache";

type RealtimeInstructionCacheInput = {
  sessionId: string;
  sessionUpdatedAt: Date | string | null;
  sessionType: string;
  candidateName: string;
  companyName: string | null;
  interviewerDisplayName: string | null;
  positionTitle: string | null;
  domain: string;
  topic: string;
  jobDescription: string | null;
  keySkills: string[];
  mandatoryQuestions: string[];
  optionalQuestions: string[];
  maxOptionalQuestions: number;
  durationSec: number;
};

/** Server-side cache for large realtime session instructions (per session revision). */
export function getCachedRealtimeInstructions(
  input: RealtimeInstructionCacheInput,
  build: () => string,
): string {
  const revision =
    input.sessionUpdatedAt instanceof Date
      ? input.sessionUpdatedAt.toISOString()
      : input.sessionUpdatedAt ?? "unknown";
  const key = `rt:${input.sessionId}:${revision}:${stableSerialize({
    sessionType: input.sessionType,
    candidateName: input.candidateName,
    mandatoryQuestions: input.mandatoryQuestions,
    optionalQuestions: input.optionalQuestions,
    keySkills: input.keySkills,
    durationSec: input.durationSec,
    voiceContext: {
      companyName: input.companyName,
      interviewerDisplayName: input.interviewerDisplayName,
      positionTitle: input.positionTitle,
      domain: input.domain,
      topic: input.topic,
      jobDescription: input.jobDescription,
      maxOptionalQuestions: input.maxOptionalQuestions,
    },
  })}`;
  return getCachedPrompt(key, build);
}
