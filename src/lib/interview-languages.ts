export const INTERVIEW_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
] as const;

export type InterviewLanguageCode = (typeof INTERVIEW_LANGUAGES)[number]["code"];

const LABEL_BY_CODE = new Map(INTERVIEW_LANGUAGES.map((l) => [l.code, l.label]));

export function isInterviewLanguageCode(value: string): value is InterviewLanguageCode {
  return LABEL_BY_CODE.has(value as InterviewLanguageCode);
}

export function interviewLanguageLabel(code: string): string {
  return LABEL_BY_CODE.get(code as InterviewLanguageCode) ?? code;
}

export function resolveInterviewLanguage(
  requirementLanguage: string | null | undefined,
  companyLanguage: string | null | undefined,
): InterviewLanguageCode {
  if (requirementLanguage && isInterviewLanguageCode(requirementLanguage)) {
    return requirementLanguage;
  }
  if (companyLanguage && isInterviewLanguageCode(companyLanguage)) {
    return companyLanguage;
  }
  return "en";
}
