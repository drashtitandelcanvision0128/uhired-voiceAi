import { z } from "zod";

export const questionDifficultySchema = z.enum(["easy", "medium", "hard"]);

export const questionInputSchema = z.union([
  z.string().trim().min(1),
  z.object({
    prompt: z.string().trim().min(1),
    expectedAnswer: z.string().trim().optional(),
    gradingRubric: z.string().trim().optional(),
    difficulty: questionDifficultySchema.optional(),
  }),
]);

export type QuestionInput = z.infer<typeof questionInputSchema>;
export type NormalizedQuestionInput = {
  prompt: string;
  expectedAnswer: string | null;
  gradingRubric: string | null;
  difficulty: "easy" | "medium" | "hard";
};

export type QuestionRecord = {
  id: string;
  prompt: string;
  isMandatory: boolean;
  orderIndex: number;
  expectedAnswer: string | null;
  gradingRubric: string | null;
  difficulty: string;
};

export type QuestionResultRow = {
  questionId: string;
  prompt: string;
  isMandatory: boolean;
  difficulty: string;
  candidateAnswer: string;
  expectedAnswer: string;
  overallScore: number;
  result: "Pass" | "Fail" | "Not Answered" | "Not Asked";
  scores: {
    technical_correctness: number;
    completeness: number;
    relevance: number;
    communication_clarity: number;
    problem_solving: number;
  };
  strengths: string[];
  weaknesses: string[];
  missing_concepts: string[];
  detailed_feedback: string;
  interviewer_summary: string;
  /** Embedding-based semantic evaluation metadata (optional, stored in JSON). */
  semantic?: {
    idealSimilarityPercent: number;
    conceptCoveragePercent: number;
    partialCredit: string;
    matchedConcepts: string[];
    scoringReasons: string[];
  };
};

export function normalizeQuestionInput(raw: QuestionInput): NormalizedQuestionInput {
  if (typeof raw === "string") {
    return {
      prompt: raw.trim(),
      expectedAnswer: null,
      gradingRubric: null,
      difficulty: "medium",
    };
  }
  return {
    prompt: raw.prompt.trim(),
    expectedAnswer: raw.expectedAnswer?.trim() || null,
    gradingRubric: raw.gradingRubric?.trim() || null,
    difficulty: raw.difficulty ?? "medium",
  };
}

export function normalizeQuestionInputs(items: QuestionInput[] | undefined): NormalizedQuestionInput[] {
  if (!items?.length) return [];
  return items.map(normalizeQuestionInput);
}

/** Pair question lines with ideal-answer lines (same index). */
export function parseQuestionAnswerLines(
  questionsText: string,
  answersText: string,
): NormalizedQuestionInput[] {
  const prompts = questionsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const answers = answersText.split("\n").map((line) => line.trim());
  return prompts.map((prompt, index) => ({
    prompt,
    expectedAnswer: answers[index] || null,
    gradingRubric: null,
    difficulty: "medium" as const,
  }));
}

type DbQuestion = {
  id: string;
  prompt: string;
  orderIndex: number;
  isMandatory: boolean;
  expectedAnswer?: string | null;
  gradingRubric?: string | null;
  difficulty?: string | null;
};

export function toQuestionRecord(q: DbQuestion): QuestionRecord {
  return {
    id: q.id,
    prompt: q.prompt,
    isMandatory: q.isMandatory,
    orderIndex: q.orderIndex,
    expectedAnswer: q.expectedAnswer?.trim() || null,
    gradingRubric: q.gradingRubric?.trim() || null,
    difficulty: q.difficulty?.trim() || "medium",
  };
}

export function resolveEffectiveQuestions(
  sessionQuestions: DbQuestion[],
  requirementQuestions: DbQuestion[],
): QuestionRecord[] {
  const source = sessionQuestions.length > 0 ? sessionQuestions : requirementQuestions;
  return source
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map(toQuestionRecord);
}

export function pickRandomQuestionRecords(items: QuestionRecord[], limit: number): QuestionRecord[] {
  if (limit <= 0 || items.length === 0) return [];
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, Math.min(limit, copy.length));
}

export function getQuestionsForGrading(
  all: QuestionRecord[],
  pickedOptionalIds: string[] | null | undefined,
): QuestionRecord[] {
  const mandatory = all.filter((q) => q.isMandatory);
  const optional = all.filter((q) => !q.isMandatory);
  const pickedSet = new Set(pickedOptionalIds ?? []);
  const pickedOptional =
    pickedSet.size > 0
      ? optional.filter((q) => pickedSet.has(q.id))
      : optional.filter((q) => q.expectedAnswer?.trim());
  return [...mandatory, ...pickedOptional].sort((a, b) => a.orderIndex - b.orderIndex);
}

export function stripAnswersFromQuestions(questions: QuestionRecord[]) {
  return questions.map(({ id, prompt, isMandatory, orderIndex, difficulty }) => ({
    id,
    prompt,
    isMandatory,
    orderIndex,
    difficulty,
  }));
}

export function questionHasGradingKey(
  q: Pick<QuestionRecord, "expectedAnswer"> | Pick<NormalizedQuestionInput, "expectedAnswer">,
): boolean {
  return Boolean(q.expectedAnswer?.trim());
}

export function buildQuestionCreateRows(
  items: NormalizedQuestionInput[],
  base: { requirementId: string } | { sessionId: string },
  isMandatory: boolean,
  startIndex: number,
) {
  return items.map((item, offset) => ({
    ...base,
    prompt: item.prompt,
    expectedAnswer: item.expectedAnswer,
    gradingRubric: item.gradingRubric,
    difficulty: item.difficulty,
    orderIndex: startIndex + offset,
    isMandatory,
  }));
}
