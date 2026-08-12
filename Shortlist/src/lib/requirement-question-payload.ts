import { z } from "zod";
import {
  buildQuestionCreateRows,
  normalizeQuestionInputs,
  parseQuestionAnswerLines,
  questionInputSchema,
  type NormalizedQuestionInput,
} from "@/lib/interview-questions";

export { buildQuestionCreateRows };

export const requirementQuestionsBodySchema = z.object({
  mandatoryQuestions: z.array(questionInputSchema).max(5).optional(),
  optionalQuestions: z.array(questionInputSchema).optional(),
  mandatoryIdealAnswers: z.string().optional(),
  optionalIdealAnswers: z.string().optional(),
});

export function resolveMandatoryOptionalQuestions(body: {
  mandatoryQuestions?: z.infer<typeof questionInputSchema>[];
  optionalQuestions?: z.infer<typeof questionInputSchema>[];
  mandatoryIdealAnswers?: string;
  optionalIdealAnswers?: string;
}): { mandatory: NormalizedQuestionInput[]; optional: NormalizedQuestionInput[] } {
  let mandatory = normalizeQuestionInputs(body.mandatoryQuestions);
  let optional = normalizeQuestionInputs(body.optionalQuestions);

  if (body.mandatoryIdealAnswers !== undefined && mandatory.length === 0) {
    mandatory = parseQuestionAnswerLines(body.mandatoryIdealAnswers, "");
  } else if (body.mandatoryIdealAnswers !== undefined && mandatory.length > 0) {
    const answers = body.mandatoryIdealAnswers.split("\n").map((line) => line.trim());
    mandatory = mandatory.map((item, index) => ({
      ...item,
      expectedAnswer: item.expectedAnswer || answers[index] || null,
    }));
  }

  if (body.optionalIdealAnswers !== undefined && optional.length === 0) {
    optional = parseQuestionAnswerLines(body.optionalIdealAnswers, "");
  } else if (body.optionalIdealAnswers !== undefined && optional.length > 0) {
    const answers = body.optionalIdealAnswers.split("\n").map((line) => line.trim());
    optional = optional.map((item, index) => ({
      ...item,
      expectedAnswer: item.expectedAnswer || answers[index] || null,
    }));
  }

  return { mandatory, optional };
}

export function buildRequirementQuestionRows(
  requirementId: string,
  mandatory: NormalizedQuestionInput[],
  optional: NormalizedQuestionInput[],
) {
  return [
    ...buildQuestionCreateRows(mandatory, { requirementId }, true, 0),
    ...buildQuestionCreateRows(optional, { requirementId }, false, mandatory.length),
  ];
}

export function buildNestedRequirementQuestionCreate(
  mandatory: NormalizedQuestionInput[],
  optional: NormalizedQuestionInput[],
) {
  const mapRow = (item: NormalizedQuestionInput, orderIndex: number, isMandatory: boolean) => ({
    prompt: item.prompt,
    expectedAnswer: item.expectedAnswer,
    gradingRubric: item.gradingRubric,
    difficulty: item.difficulty,
    orderIndex,
    isMandatory,
  });
  return [
    ...mandatory.map((item, index) => mapRow(item, index, true)),
    ...optional.map((item, index) => mapRow(item, mandatory.length + index, false)),
  ];
}

export function mapRequirementQuestionsForAdmin(
  questions: Array<{
    prompt: string;
    isMandatory: boolean;
    expectedAnswer?: string | null;
    gradingRubric?: string | null;
    difficulty?: string | null;
  }>,
) {
  const mandatory = questions.filter((q) => q.isMandatory);
  const optional = questions.filter((q) => !q.isMandatory);
  return {
    mandatoryQuestions: mandatory.map((q) => q.prompt),
    mandatoryIdealAnswers: mandatory.map((q) => q.expectedAnswer ?? "").join("\n"),
    optionalQuestions: optional.map((q) => q.prompt),
    optionalIdealAnswers: optional.map((q) => q.expectedAnswer ?? "").join("\n"),
    mandatoryQuestionItems: mandatory.map((q) => ({
      prompt: q.prompt,
      expectedAnswer: q.expectedAnswer,
      gradingRubric: q.gradingRubric,
      difficulty: q.difficulty ?? "medium",
    })),
    optionalQuestionItems: optional.map((q) => ({
      prompt: q.prompt,
      expectedAnswer: q.expectedAnswer,
      gradingRubric: q.gradingRubric,
      difficulty: q.difficulty ?? "medium",
    })),
  };
}
