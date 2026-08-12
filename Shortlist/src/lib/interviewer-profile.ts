import type { InterviewerVoiceGender } from "@prisma/client";

export const REALTIME_VOICE_BY_GENDER = {
  MALE: "cedar",
  FEMALE: "marin",
} as const;

export type RealtimeBuiltinVoice =
  (typeof REALTIME_VOICE_BY_GENDER)[keyof typeof REALTIME_VOICE_BY_GENDER];

export function resolveRealtimeVoice(
  gender: InterviewerVoiceGender | null | undefined,
): RealtimeBuiltinVoice {
  return gender === "FEMALE" ? REALTIME_VOICE_BY_GENDER.FEMALE : REALTIME_VOICE_BY_GENDER.MALE;
}

export function resolveInterviewerDisplayName(
  interviewerName: string | null | undefined,
  companyName: string | null | undefined,
): string | null {
  const trimmed = interviewerName?.trim();
  if (trimmed) return trimmed;
  const org = companyName?.trim();
  if (org) return `the ${org} hiring team`;
  return null;
}

export type CompanyInterviewerProfile = {
  interviewerName: string | null;
  interviewerVoiceGender: InterviewerVoiceGender;
  voice: RealtimeBuiltinVoice;
  displayName: string | null;
};

export function resolveInterviewerPanelLabel(input: {
  sessionType: "PRACTICE" | "COMPANY";
  interviewerName: string | null | undefined;
  companyName: string | null | undefined;
}): string {
  if (input.sessionType === "PRACTICE") return "Practice Interviewer";
  const name = input.interviewerName?.trim();
  if (name) return name;
  const org = input.companyName?.trim();
  if (org) return `${org} Interviewer`;
  return "Interviewer (AI)";
}

export function resolveInterviewerVoiceLabel(
  gender: InterviewerVoiceGender | null | undefined,
): string | null {
  if (gender === "FEMALE") return "Female voice";
  if (gender === "MALE") return "Male voice";
  return null;
}

export function buildCompanyInterviewerProfile(input: {
  interviewerName: string | null | undefined;
  interviewerVoiceGender: InterviewerVoiceGender | null | undefined;
  companyName: string | null | undefined;
}): CompanyInterviewerProfile {
  const interviewerVoiceGender = input.interviewerVoiceGender ?? "MALE";
  return {
    interviewerName: input.interviewerName?.trim() || null,
    interviewerVoiceGender,
    voice: resolveRealtimeVoice(interviewerVoiceGender),
    displayName: resolveInterviewerDisplayName(input.interviewerName, input.companyName),
  };
}
