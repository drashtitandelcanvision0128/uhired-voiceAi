import type { QuestionResultRow } from "@/lib/interview-questions";

export function parseQuestionResultsFromScorecard(value: unknown): QuestionResultRow[] | null {
  if (!value) return null;
  if (!Array.isArray(value)) return null;
  const rows: QuestionResultRow[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.prompt !== "string" || typeof row.questionId !== "string") continue;
    rows.push({
      questionId: row.questionId,
      prompt: row.prompt,
      isMandatory: Boolean(row.isMandatory),
      difficulty: typeof row.difficulty === "string" ? row.difficulty : "medium",
      candidateAnswer: typeof row.candidateAnswer === "string" ? row.candidateAnswer : "",
      expectedAnswer: typeof row.expectedAnswer === "string" ? row.expectedAnswer : "",
      overallScore: typeof row.overallScore === "number" ? row.overallScore : 0,
      result:
        row.result === "Pass"
          ? "Pass"
          : row.result === "Not Asked"
            ? "Not Asked"
            : row.result === "Not Answered"
              ? "Not Answered"
              : "Fail",
      scores: {
        technical_correctness: Number((row.scores as Record<string, unknown>)?.technical_correctness ?? 0),
        completeness: Number((row.scores as Record<string, unknown>)?.completeness ?? 0),
        relevance: Number((row.scores as Record<string, unknown>)?.relevance ?? 0),
        communication_clarity: Number((row.scores as Record<string, unknown>)?.communication_clarity ?? 0),
        problem_solving: Number((row.scores as Record<string, unknown>)?.problem_solving ?? 0),
      },
      strengths: Array.isArray(row.strengths) ? row.strengths.map(String) : [],
      weaknesses: Array.isArray(row.weaknesses) ? row.weaknesses.map(String) : [],
      missing_concepts: Array.isArray(row.missing_concepts) ? row.missing_concepts.map(String) : [],
      detailed_feedback: typeof row.detailed_feedback === "string" ? row.detailed_feedback : "",
      interviewer_summary: typeof row.interviewer_summary === "string" ? row.interviewer_summary : "",
    });
  }
  return rows.length > 0 ? rows : null;
}
