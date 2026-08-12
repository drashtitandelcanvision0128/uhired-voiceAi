import type { NormalizedQuestionInput } from "./interview-questions";

/** Automation platforms often hallucinated for unrelated roles (e.g. MERN web dev). */
const OFF_TOPIC_AUTOMATION_PATTERN =
  /\b(n8n|zapier|make\.com|integromat|whatsapp\s+automation|telegram\s+(bot|automation)|workflow\s+automation\s+(tool|platform))\b/i;

function roleContextAllowsAutomation(
  keySkills: string[],
  positionTitle: string,
  jobDescription?: string | null,
): boolean {
  const context = [positionTitle, jobDescription ?? "", ...keySkills].join(" ").toLowerCase();
  return /\b(automation|n8n|zapier|workflow|rpa|bot)\b/.test(context);
}

/**
 * Drops generated questions that reference automation tooling when the role
 * context does not call for it.
 */
export function filterQuestionsToRoleScope(
  questions: NormalizedQuestionInput[],
  keySkills: string[],
  positionTitle: string,
  jobDescription?: string | null,
): NormalizedQuestionInput[] {
  if (roleContextAllowsAutomation(keySkills, positionTitle, jobDescription)) {
    return questions;
  }

  return questions.filter((q) => !OFF_TOPIC_AUTOMATION_PATTERN.test(q.prompt));
}
