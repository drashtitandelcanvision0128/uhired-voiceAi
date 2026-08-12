import { generateQuestionsFromJobDescription } from "./job-description-to-questions";
import type { NormalizedQuestionInput } from "./interview-questions";
import {
  buildSkillBasedFallbackQuestions,
  DEFAULT_BEHAVIORAL_FALLBACK,
  orderMandatoryQuestions,
  prioritizeTechnicalQuestions,
} from "./interview-prompt";
import { computeMandatoryQuestionCount, MAX_MANDATORY_QUESTIONS } from "./interview-duration";
import { expandKeySkills } from "./key-skill-expansion";
import { filterQuestionsToRoleScope } from "./question-role-scope";

export type ResolveMandatoryQuestionsInput = {
  manualMandatory: NormalizedQuestionInput[];
  positionTitle: string;
  jobDescription?: string | null;
  keySkills?: string[];
  domain?: string;
  topic?: string;
  durationMin?: number;
  maxQuestions?: number;
};

/**
 * Resolves mandatory interview questions: admin-provided first, then AI from JD,
 * then skill-based technical fallbacks, then a single behavioral fallback.
 */
export async function resolveMandatoryQuestionsForRequirement(
  input: ResolveMandatoryQuestionsInput,
): Promise<NormalizedQuestionInput[]> {
  const maxQuestions = Math.min(
    MAX_MANDATORY_QUESTIONS,
    Math.max(
      1,
      input.maxQuestions ??
        (input.durationMin != null ? computeMandatoryQuestionCount(input.durationMin) : 5),
    ),
  );

  if (input.manualMandatory.length > 0) {
    return orderMandatoryQuestions(input.manualMandatory.slice(0, maxQuestions));
  }

  const jd = input.jobDescription?.trim();
  const positionTitle = input.positionTitle.trim() || "General Role";
  const keySkills = expandKeySkills((input.keySkills ?? []).map((s) => s.trim()).filter(Boolean));

  if (jd && process.env.OPENAI_API_KEY) {
    try {
      const generated = await generateQuestionsFromJobDescription({
        jobDescription: jd,
        positionTitle,
        domain: input.domain ?? positionTitle,
        keySkills,
        questionCount: maxQuestions,
      });
      const mapped: NormalizedQuestionInput[] = generated.map((q) => ({
        prompt: q.prompt.trim(),
        expectedAnswer: q.expectedAnswer?.trim() || null,
        gradingRubric: null,
        difficulty: q.difficulty ?? "medium",
      }));
      const scoped = filterQuestionsToRoleScope(mapped, keySkills, positionTitle, jd);
      const prioritized = prioritizeTechnicalQuestions(scoped);
      const normalized = orderMandatoryQuestions(prioritized.slice(0, maxQuestions));
      if (normalized.length > 0) return normalized;
    } catch (error) {
      console.error("AI question generation failed, using skill-based fallback:", error);
    }
  }

  const skillBased = buildSkillBasedFallbackQuestions(keySkills, positionTitle, maxQuestions);
  if (skillBased.length > 0) return skillBased;

  return [DEFAULT_BEHAVIORAL_FALLBACK];
}
