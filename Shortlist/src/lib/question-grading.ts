import { z } from "zod";
import { extractResponsesOutputText } from "@/lib/openai-responses";
import { buildFallbackIdealAnswer } from "@/lib/generate-ideal-answers";
import { buildQuestionGradingPrompt } from "@/lib/question-grading-prompt";
import {
  type QuestionRecord,
  type QuestionResultRow,
  questionHasGradingKey,
} from "@/lib/interview-questions";
import { getScoringModel } from "@/lib/scoring";
import { env } from "@/lib/env";
import {
  blendCategoryScores,
  evaluateAnswerSemantics,
  type SemanticEvaluationResult,
} from "@/lib/semantic-evaluation";

/** Per-question overall score (0–10): 6+ Pass, 5 or below Fail. */
export const QUESTION_PASS_THRESHOLD = 6;

type TranscriptTurn = { speaker: string; message: string };

const categoryScoresSchema = z.object({
  technical_correctness: z.number(),
  completeness: z.number(),
  relevance: z.number(),
  communication_clarity: z.number(),
  problem_solving: z.number(),
});

const questionGradeSchema = z.object({
  role: z.string().optional(),
  question: z.string().optional(),
  difficulty: z.string().optional(),
  scores: categoryScoresSchema,
  overall_score: z.number(),
  result: z.string(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  missing_concepts: z.array(z.string()).default([]),
  detailed_feedback: z.string().default(""),
  interviewer_summary: z.string().default(""),
});

const alignItemSchema = z.object({
  questionId: z.string(),
  candidateAnswer: z.string(),
});

const alignResponseSchema = z.object({
  mappings: z.array(alignItemSchema),
});

function clampScore10(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10, Math.round(value)));
}

function computeOverallFromCategories(scores: z.infer<typeof categoryScoresSchema>): number {
  const values = [
    scores.technical_correctness,
    scores.completeness,
    scores.relevance,
    scores.communication_clarity,
    scores.problem_solving,
  ];
  const sum = values.reduce((total, value) => total + clampScore10(value), 0);
  return clampScore10(sum / values.length);
}

function buildTranscriptBlock(turns: TranscriptTurn[]): string {
  return turns
    .map((turn, index) => {
      const speaker = turn.speaker.toUpperCase() === "INTERVIEWER" ? "INTERVIEWER" : "CANDIDATE";
      return `${index + 1}. ${speaker}: ${turn.message.trim()}`;
    })
    .join("\n");
}

async function callOpenAiJson<T>(prompt: string, schemaName: string, schema: Record<string, unknown>): Promise<T | null> {
  if (!env.openAiApiKey) return null;

  const model = getScoringModel();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: "You output strict JSON only." }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Question grading API failed: ${errorText}`);
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  const outputText = extractResponsesOutputText(payload);
  if (!outputText) return null;
  return JSON.parse(outputText) as T;
}

const alignJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    mappings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          questionId: { type: "string" },
          candidateAnswer: { type: "string" },
        },
        required: ["questionId", "candidateAnswer"],
      },
    },
  },
  required: ["mappings"],
} as const;

export async function alignTranscriptToQuestions(input: {
  turns: TranscriptTurn[];
  questions: QuestionRecord[];
}): Promise<Map<string, string>> {
  const gradable = input.questions.filter(questionHasGradingKey);
  const result = new Map<string, string>();
  if (!gradable.length) return result;

  const transcript = buildTranscriptBlock(input.turns);
  const questionList = gradable
    .map((q, index) => `${index + 1}. [id=${q.id}] ${q.prompt}`)
    .join("\n");

  const prompt = [
    "Map each listed interview question to the candidate's answer from the transcript.",
    "Rules:",
    "- Use question ids exactly as provided.",
    "- The interviewer may paraphrase agenda questions; match by intent/topic, not exact wording.",
    "- Merge follow-up answers for the same question into one candidateAnswer string.",
    "- If the question was not clearly asked or not answered, set candidateAnswer to an empty string.",
    "- Do not invent content not present in the transcript.",
    "- Output English text only in candidateAnswer fields.",
    "",
    "Questions:",
    questionList,
    "",
    "Transcript:",
    transcript || "(empty)",
    "",
    'Return JSON: { "mappings": [{ "questionId": "...", "candidateAnswer": "..." }] }',
  ].join("\n");

  try {
    const aligned = await callOpenAiJson<z.infer<typeof alignResponseSchema>>(
      prompt,
      "question_transcript_align",
      alignJsonSchema,
    );
    if (!aligned) return heuristicAlign(input.turns, gradable);

    const parsed = alignResponseSchema.safeParse(aligned);
    if (!parsed.success) return heuristicAlign(input.turns, gradable);

    for (const row of parsed.data.mappings) {
      result.set(row.questionId, row.candidateAnswer.trim());
    }
    return result;
  } catch {
    return heuristicAlign(input.turns, gradable);
  }
}

function heuristicAlign(turns: TranscriptTurn[], questions: QuestionRecord[]): Map<string, string> {
  const result = new Map<string, string>();
  const candidateChunks: string[] = [];
  for (const turn of turns) {
    if (turn.speaker.toUpperCase() === "CANDIDATE") {
      const text = turn.message.trim();
      if (text) candidateChunks.push(text);
    }
  }

  const chunkCount = candidateChunks.length;
  const questionCount = questions.length;
  if (chunkCount === 0 || questionCount === 0) {
    for (const q of questions) result.set(q.id, "");
    return result;
  }

  for (let i = 0; i < questionCount; i += 1) {
    const q = questions[i]!;
    if (chunkCount === questionCount) {
      result.set(q.id, candidateChunks[i] ?? "");
      continue;
    }
    const start = Math.floor((i * chunkCount) / questionCount);
    const end = Math.floor(((i + 1) * chunkCount) / questionCount);
    result.set(q.id, candidateChunks.slice(start, Math.max(start + 1, end)).join(" ").trim());
  }
  return result;
}

const gradeJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    role: { type: "string" },
    question: { type: "string" },
    difficulty: { type: "string" },
    scores: {
      type: "object",
      additionalProperties: false,
      properties: {
        technical_correctness: { type: "number" },
        completeness: { type: "number" },
        relevance: { type: "number" },
        communication_clarity: { type: "number" },
        problem_solving: { type: "number" },
      },
      required: [
        "technical_correctness",
        "completeness",
        "relevance",
        "communication_clarity",
        "problem_solving",
      ],
    },
    overall_score: { type: "number" },
    result: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    missing_concepts: { type: "array", items: { type: "string" } },
    detailed_feedback: { type: "string" },
    interviewer_summary: { type: "string" },
  },
  required: [
    "role",
    "question",
    "difficulty",
    "scores",
    "overall_score",
    "result",
    "strengths",
    "weaknesses",
    "missing_concepts",
    "detailed_feedback",
    "interviewer_summary",
  ],
} as const;

function toSemanticMetadata(semantic: SemanticEvaluationResult): NonNullable<QuestionResultRow["semantic"]> {
  return {
    idealSimilarityPercent: Math.round(semantic.idealSimilarity * 100),
    conceptCoveragePercent: Math.round(semantic.conceptCoverageScore * 100),
    partialCredit: semantic.partialCredit,
    matchedConcepts: semantic.matchedConcepts.slice(0, 8),
    scoringReasons: semantic.scoringReasons.slice(0, 8),
  };
}

function buildSemanticFeedback(semantic: SemanticEvaluationResult, llmFeedback: string): string {
  const reasons = semantic.scoringReasons.slice(0, 3).join(" ");
  const combined = `${llmFeedback.trim()} ${reasons}`.trim();
  return combined.slice(0, 1200);
}

export async function gradeSingleQuestion(input: {
  role: string;
  question: QuestionRecord;
  candidateAnswer: string;
  keySkills: string[];
}): Promise<QuestionResultRow | null> {
  const ideal = input.question.expectedAnswer?.trim();
  if (!ideal) return null;

  const semantic = await evaluateAnswerSemantics({
    question: input.question.prompt,
    idealAnswer: ideal,
    candidateAnswer: input.candidateAnswer,
  });

  const prompt = buildQuestionGradingPrompt({
    role: input.role,
    question: input.question.prompt,
    idealAnswer: ideal,
    keySkills: input.keySkills.length ? input.keySkills.join(", ") : "Not specified",
    difficulty: input.question.difficulty || "medium",
    candidateAnswer: input.candidateAnswer.trim() || "(no answer captured)",
    gradingRubric: input.question.gradingRubric,
    semanticContext: semantic,
  });

  const raw = await callOpenAiJson<z.infer<typeof questionGradeSchema>>(
    prompt,
    "question_answer_grade",
    gradeJsonSchema,
  );
  if (!raw) return buildFallbackGrade(input.question, input.candidateAnswer, semantic);

  const parsed = questionGradeSchema.safeParse(raw);
  if (!parsed.success) return buildFallbackGrade(input.question, input.candidateAnswer, semantic);

  const llmScores = {
    technical_correctness: clampScore10(parsed.data.scores.technical_correctness),
    completeness: clampScore10(parsed.data.scores.completeness),
    relevance: clampScore10(parsed.data.scores.relevance),
    communication_clarity: clampScore10(parsed.data.scores.communication_clarity),
    problem_solving: clampScore10(parsed.data.scores.problem_solving),
  };
  const scores = blendCategoryScores(llmScores, semantic.suggestedScores);
  const overallScore = computeOverallFromCategories(scores);
  const result: "Pass" | "Fail" | "Not Answered" = overallScore >= QUESTION_PASS_THRESHOLD ? "Pass" : "Fail";

  const mergedMissingConcepts = [
    ...new Set([
      ...parsed.data.missing_concepts,
      ...semantic.missingConcepts,
    ]),
  ].slice(0, 8);

  return {
    questionId: input.question.id,
    prompt: input.question.prompt,
    isMandatory: input.question.isMandatory,
    difficulty: input.question.difficulty || "medium",
    candidateAnswer: input.candidateAnswer.trim(),
    expectedAnswer: ideal,
    overallScore,
    result,
    scores,
    strengths: parsed.data.strengths.slice(0, 5),
    weaknesses: parsed.data.weaknesses.slice(0, 5),
    missing_concepts: mergedMissingConcepts,
    detailed_feedback: buildSemanticFeedback(semantic, parsed.data.detailed_feedback),
    interviewer_summary: parsed.data.interviewer_summary.slice(0, 400),
    semantic: toSemanticMetadata(semantic),
  };
}

export function buildNotAskedQuestionResult(question: QuestionRecord): QuestionResultRow {
  const ideal = question.expectedAnswer?.trim() ?? "";
  return {
    questionId: question.id,
    prompt: question.prompt,
    isMandatory: question.isMandatory,
    difficulty: question.difficulty || "medium",
    candidateAnswer: "",
    expectedAnswer: ideal,
    overallScore: 0,
    result: "Not Asked",
    scores: {
      technical_correctness: 0,
      completeness: 0,
      relevance: 0,
      communication_clarity: 0,
      problem_solving: 0,
    },
    strengths: [],
    weaknesses: ["This question was not asked during the interview."],
    missing_concepts: [],
    detailed_feedback: "The interviewer did not ask this question before the session ended.",
    interviewer_summary: "Not asked.",
  };
}

function hasSubstantiveCandidateAnswer(candidateAnswer: string): boolean {
  const normalized = candidateAnswer.trim().toLowerCase();
  return (
    normalized.length > 8 &&
    normalized !== "i don't know" &&
    normalized !== "i dont know"
  );
}

function buildFallbackGrade(
  question: QuestionRecord,
  candidateAnswer: string,
  semantic?: SemanticEvaluationResult,
  forceNotAnswered?: boolean,
): QuestionResultRow {
  const ideal = question.expectedAnswer?.trim() ?? "";
  const normalized = candidateAnswer.trim().toLowerCase();
  const empty =
    !normalized ||
    normalized === "i don't know" ||
    normalized === "i dont know" ||
    normalized.length < 8;
  
  if (forceNotAnswered || empty) {
    const notAnsweredResult: QuestionResultRow = {
      questionId: question.id,
      prompt: question.prompt,
      isMandatory: question.isMandatory,
      difficulty: question.difficulty || "medium",
      candidateAnswer: candidateAnswer.trim(),
      expectedAnswer: ideal,
      overallScore: 0,
      result: "Not Answered" as const,
      scores: {
        technical_correctness: 0,
        completeness: 0,
        relevance: 0,
        communication_clarity: 0,
        problem_solving: 0,
      },
      strengths: [],
      weaknesses: ["Question was not answered during the interview."],
      missing_concepts: [],
      detailed_feedback: "This question was not addressed in the interview.",
      interviewer_summary: "No answer provided.",
    };
    return notAnsweredResult;
  }

  const scores = semantic?.suggestedScores ?? {
    technical_correctness: 5,
    completeness: 5,
    relevance: 5,
    communication_clarity: 5,
    problem_solving: 5,
  };
  const overallScore = computeOverallFromCategories(scores);
  const result: "Pass" | "Fail" | "Not Answered" = overallScore >= QUESTION_PASS_THRESHOLD ? "Pass" : "Fail";

  const passFailResult: QuestionResultRow = {
    questionId: question.id,
    prompt: question.prompt,
    isMandatory: question.isMandatory,
    difficulty: question.difficulty || "medium",
    candidateAnswer: candidateAnswer.trim(),
    expectedAnswer: ideal,
    overallScore,
    result: result as "Pass" | "Fail",
    scores,
    strengths: semantic?.matchedConcepts.slice(0, 3) ?? [],
    weaknesses: semantic?.missingConcepts.length
      ? [`Missing concepts: ${semantic.missingConcepts.slice(0, 3).join("; ")}`]
      : ["LLM grading unavailable; semantic embedding fallback used."],
    missing_concepts: semantic?.missingConcepts.slice(0, 8) ?? [],
    detailed_feedback: semantic
      ? buildSemanticFeedback(
          semantic,
          "Graded with semantic embedding analysis because LLM grading was unavailable.",
        )
      : "Graded with fallback heuristic because LLM grading was unavailable.",
    interviewer_summary: semantic
      ? `Semantic match ${Math.round(semantic.idealSimilarity * 100)}%; partial credit: ${semantic.partialCredit}.`
      : "Partial or unverified answer.",
    semantic: semantic ? toSemanticMetadata(semantic) : undefined,
  };
  return passFailResult;
}

export async function runQuestionGradingForSession(input: {
  turns: TranscriptTurn[];
  questions: QuestionRecord[];
  role: string;
  keySkills: string[];
  /** When set (e.g. from transcript Q&A extraction), used instead of re-aligning. */
  prefilledAnswers?: Map<string, string>;
}): Promise<{ accuracyPercent: number; questionResults: QuestionResultRow[] } | null> {
  if (!input.questions.length) return null;

  const answerByQuestionId =
    input.prefilledAnswers && input.prefilledAnswers.size > 0
      ? new Map(input.prefilledAnswers)
      : await alignTranscriptToQuestions({
          turns: input.turns,
          questions: input.questions,
        });

  const results: QuestionResultRow[] = [];
  const concurrency = 3;
  for (let i = 0; i < input.questions.length; i += concurrency) {
    const batch = input.questions.slice(i, i + concurrency);
    const batchRows = await Promise.all(
      batch.map(async (question): Promise<QuestionResultRow> => {
        const questionForGrading = questionHasGradingKey(question)
          ? question
          : {
              ...question,
              expectedAnswer: buildFallbackIdealAnswer(question.prompt, input.role),
            };
        const candidateAnswer = answerByQuestionId.get(question.id) ?? "";
        if (!hasSubstantiveCandidateAnswer(candidateAnswer)) {
          // Return a result indicating the question was not answered
          const notAnsweredResult: QuestionResultRow = {
            questionId: question.id,
            prompt: question.prompt,
            isMandatory: question.isMandatory,
            difficulty: question.difficulty || "medium",
            candidateAnswer: candidateAnswer.trim(),
            expectedAnswer: questionForGrading.expectedAnswer?.trim() ?? "",
            overallScore: 0,
            result: "Not Answered" as const,
            scores: {
              technical_correctness: 0,
              completeness: 0,
              relevance: 0,
              communication_clarity: 0,
              problem_solving: 0,
            },
            strengths: [],
            weaknesses: ["Question was not answered during the interview."],
            missing_concepts: [],
            detailed_feedback: "This question was not addressed in the interview.",
            interviewer_summary: "No answer provided.",
          };
          return notAnsweredResult;
        }

        try {
          const row = await gradeSingleQuestion({
            role: input.role,
            question: questionForGrading,
            candidateAnswer,
            keySkills: input.keySkills,
          });
          return row ?? buildFallbackGrade(questionForGrading, candidateAnswer);
        } catch (error) {
          try {
            const semantic = await evaluateAnswerSemantics({
              question: questionForGrading.prompt,
              idealAnswer: questionForGrading.expectedAnswer?.trim() ?? "",
              candidateAnswer,
            });
            return buildFallbackGrade(questionForGrading, candidateAnswer, semantic);
          } catch {
            return buildFallbackGrade(questionForGrading, candidateAnswer);
          }
        }
      }),
    );
    results.push(...batchRows);
  }

  if (!results.length) return null;

  // Calculate accuracy based only on graded Pass/Fail questions
  const answeredResults = results.filter((r) => r.result === "Pass" || r.result === "Fail");
  const accuracyPercent = answeredResults.length > 0
    ? Math.round(
        (answeredResults.reduce((sum, row) => sum + row.overallScore, 0) / (answeredResults.length * 10)) * 100,
      )
    : 0;

  return { accuracyPercent, questionResults: results };
}

export function mergeQuestionGradingIntoScorecard<
  T extends {
    overallScore: number;
    communication: number;
    domainDepth: number;
    confidence: number;
    summary: string;
    strengths: string[];
    improvements: string[];
    evidence: string[];
    scoringMode: string;
    scoringModel: string | null;
  },
>(
  baseScore: T,
  grading: { accuracyPercent: number; questionResults: QuestionResultRow[] },
): T & { accuracyPercent: number; questionResults: QuestionResultRow[]; overallScore: number } {
  const holisticOverall =
    typeof baseScore.overallScore === "number" ? baseScore.overallScore : grading.accuracyPercent;
  const blendedOverall = Math.round(grading.accuracyPercent * 0.8 + holisticOverall * 0.2);

  return {
    ...baseScore,
    accuracyPercent: grading.accuracyPercent,
    questionResults: grading.questionResults,
    overallScore: blendedOverall,
  };
}
