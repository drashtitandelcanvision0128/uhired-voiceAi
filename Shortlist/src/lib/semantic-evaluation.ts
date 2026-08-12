import {
  extractConceptsFromIdealAnswer,
  preprocessSpokenAnswer,
} from "@/lib/answer-preprocessing";
import { env } from "@/lib/env";

export type ConceptMatch = {
  concept: string;
  similarity: number;
  matched: boolean;
};

export type SemanticPartialCredit = "none" | "low" | "moderate" | "high" | "excellent";

export type SemanticEvaluationResult = {
  preprocessedAnswer: string;
  removedFillerCount: number;
  /** Cosine similarity (0–1) between candidate and ideal answer embeddings. */
  idealSimilarity: number;
  /** Average similarity across matched key concepts (0–1). */
  conceptCoverageScore: number;
  concepts: ConceptMatch[];
  matchedConcepts: string[];
  missingConcepts: string[];
  partialCredit: SemanticPartialCredit;
  /** Suggested 0–10 scores derived from embeddings (used for blending / fallback). */
  suggestedScores: {
    technical_correctness: number;
    completeness: number;
    relevance: number;
    communication_clarity: number;
    problem_solving: number;
  };
  scoringReasons: string[];
};

const CONCEPT_MATCH_THRESHOLD = 0.62;
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";

export function getEmbeddingModel(): string {
  return env.embeddingModel || DEFAULT_EMBEDDING_MODEL;
}

export function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length === 0 || vectorB.length === 0 || vectorA.length !== vectorB.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vectorA.length; i += 1) {
    const a = vectorA[i] ?? 0;
    const b = vectorB[i] ?? 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function clampSimilarity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function similarityToScore10(similarity: number): number {
  const clamped = clampSimilarity(similarity);
  return Math.max(0, Math.min(10, Math.round(clamped * 10)));
}

function classifyPartialCredit(
  idealSimilarity: number,
  conceptCoverageScore: number,
  matchedCount: number,
  totalConcepts: number,
): SemanticPartialCredit {
  const coverageRatio = totalConcepts > 0 ? matchedCount / totalConcepts : idealSimilarity;

  if (idealSimilarity >= 0.82 && coverageRatio >= 0.75) return "excellent";
  if (idealSimilarity >= 0.72 || coverageRatio >= 0.65) return "high";
  if (idealSimilarity >= 0.58 || coverageRatio >= 0.45) return "moderate";
  if (idealSimilarity >= 0.42 || coverageRatio >= 0.25) return "low";
  return "none";
}

function buildSuggestedScores(input: {
  idealSimilarity: number;
  conceptCoverageScore: number;
  partialCredit: SemanticPartialCredit;
}): SemanticEvaluationResult["suggestedScores"] {
  const base = similarityToScore10(
    input.conceptCoverageScore * 0.55 + input.idealSimilarity * 0.45,
  );

  const partialBoost: Record<SemanticPartialCredit, number> = {
    none: 0,
    low: 0,
    moderate: 1,
    high: 2,
    excellent: 1,
  };

  const adjusted = Math.max(0, Math.min(10, base + partialBoost[input.partialCredit]));

  return {
    technical_correctness: adjusted,
    completeness: similarityToScore10(input.conceptCoverageScore),
    relevance: similarityToScore10(input.idealSimilarity),
    communication_clarity: Math.max(adjusted - 1, 4),
    problem_solving: adjusted,
  };
}

function buildScoringReasons(input: {
  idealSimilarity: number;
  conceptCoverageScore: number;
  matchedConcepts: string[];
  missingConcepts: string[];
  partialCredit: SemanticPartialCredit;
  removedFillerCount: number;
}): string[] {
  const reasons: string[] = [];
  const idealPct = Math.round(input.idealSimilarity * 100);
  const coveragePct = Math.round(input.conceptCoverageScore * 100);

  reasons.push(
    `Semantic similarity to the ideal answer: ${idealPct}% (meaning-based, not keyword matching).`,
  );
  reasons.push(`Key concept coverage: ${coveragePct}% based on embedding similarity.`);

  if (input.removedFillerCount > 0) {
    reasons.push(
      `Ignored ${input.removedFillerCount} filler word(s); grammar and speaking style were not penalized.`,
    );
  }

  if (input.matchedConcepts.length > 0) {
    reasons.push(
      `Correct concepts detected: ${input.matchedConcepts.slice(0, 4).join("; ")}.`,
    );
  }

  if (input.missingConcepts.length > 0) {
    reasons.push(
      `Missing or weak concepts: ${input.missingConcepts.slice(0, 4).join("; ")}.`,
    );
  }

  const partialLabels: Record<SemanticPartialCredit, string> = {
    none: "Answer does not demonstrate sufficient understanding of the expected concepts.",
    low: "Partially correct: some related ideas present but core concepts are weak or missing.",
    moderate: "Partially correct: candidate shows moderate understanding with notable gaps.",
    high: "Mostly correct: strong semantic alignment with equivalent phrasing or different structure.",
    excellent: "Strong answer: concepts match the ideal answer even if wording differs.",
  };
  reasons.push(partialLabels[input.partialCredit]);

  return reasons.slice(0, 8);
}

async function fetchEmbeddings(texts: string[]): Promise<number[][] | null> {
  if (!env.openAiApiKey) return null;

  const inputs = texts.map((text) => text.trim()).filter(Boolean);
  if (!inputs.length) return null;

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getEmbeddingModel(),
      input: inputs,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[]; index?: number }>;
  };

  const rows = payload.data ?? [];
  if (!rows.length) return null;

  const sorted = [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  return sorted.map((row) => row.embedding ?? []);
}

function buildHeuristicSemanticResult(input: {
  question: string;
  idealAnswer: string;
  candidateAnswer: string;
}): SemanticEvaluationResult {
  const preprocessed = preprocessSpokenAnswer(input.candidateAnswer);
  const concepts = extractConceptsFromIdealAnswer(input.idealAnswer);

  const idealTokens = new Set(
    input.idealAnswer
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4),
  );
  const candidateTokens = new Set(
    preprocessed.cleaned
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4),
  );

  let overlap = 0;
  for (const token of idealTokens) {
    if (candidateTokens.has(token)) overlap += 1;
  }
  const idealSimilarity =
    idealTokens.size > 0 ? clampSimilarity(overlap / Math.max(idealTokens.size, 1)) : 0;

  const conceptMatches: ConceptMatch[] = concepts.map((concept) => {
    const conceptTokens = concept
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4);
    const matchedTokens = conceptTokens.filter((token) => candidateTokens.has(token)).length;
    const similarity =
      conceptTokens.length > 0
        ? clampSimilarity(matchedTokens / conceptTokens.length)
        : 0;
    return {
      concept,
      similarity,
      matched: similarity >= CONCEPT_MATCH_THRESHOLD,
    };
  });

  const matchedConcepts = conceptMatches.filter((row) => row.matched).map((row) => row.concept);
  const missingConcepts = conceptMatches.filter((row) => !row.matched).map((row) => row.concept);
  const conceptCoverageScore =
    conceptMatches.length > 0
      ? conceptMatches.reduce((sum, row) => sum + row.similarity, 0) / conceptMatches.length
      : idealSimilarity;

  const partialCredit = classifyPartialCredit(
    idealSimilarity,
    conceptCoverageScore,
    matchedConcepts.length,
    concepts.length,
  );

  const suggestedScores = buildSuggestedScores({
    idealSimilarity,
    conceptCoverageScore,
    partialCredit,
  });

  return {
    preprocessedAnswer: preprocessed.cleaned,
    removedFillerCount: preprocessed.removedFillerCount,
    idealSimilarity,
    conceptCoverageScore,
    concepts: conceptMatches,
    matchedConcepts,
    missingConcepts,
    partialCredit,
    suggestedScores,
    scoringReasons: buildScoringReasons({
      idealSimilarity,
      conceptCoverageScore,
      matchedConcepts,
      missingConcepts,
      partialCredit,
      removedFillerCount: preprocessed.removedFillerCount,
    }),
  };
}

/**
 * Semantic evaluation using OpenAI embeddings. Falls back to token overlap when
 * embeddings are unavailable (no API key or request failure).
 */
export async function evaluateAnswerSemantics(input: {
  question: string;
  idealAnswer: string;
  candidateAnswer: string;
}): Promise<SemanticEvaluationResult> {
  const preprocessed = preprocessSpokenAnswer(input.candidateAnswer);
  const concepts = extractConceptsFromIdealAnswer(input.idealAnswer);

  if (!preprocessed.cleaned || preprocessed.cleaned.length < 8) {
    return {
      preprocessedAnswer: preprocessed.cleaned,
      removedFillerCount: preprocessed.removedFillerCount,
      idealSimilarity: 0,
      conceptCoverageScore: 0,
      concepts: concepts.map((concept) => ({ concept, similarity: 0, matched: false })),
      matchedConcepts: [],
      missingConcepts: concepts,
      partialCredit: "none",
      suggestedScores: {
        technical_correctness: 0,
        completeness: 0,
        relevance: 0,
        communication_clarity: 0,
        problem_solving: 0,
      },
      scoringReasons: ["No substantive answer captured for semantic evaluation."],
    };
  }

  const textsToEmbed = [preprocessed.cleaned, input.idealAnswer, ...concepts];
  const embeddings = await fetchEmbeddings(textsToEmbed);

  if (!embeddings || embeddings.length < 2) {
    return buildHeuristicSemanticResult(input);
  }

  const candidateEmbedding = embeddings[0] ?? [];
  const idealEmbedding = embeddings[1] ?? [];
  const conceptEmbeddings = embeddings.slice(2);

  const idealSimilarity = clampSimilarity(cosineSimilarity(candidateEmbedding, idealEmbedding));

  const conceptMatches: ConceptMatch[] = concepts.map((concept, index) => {
    const similarity = clampSimilarity(
      cosineSimilarity(candidateEmbedding, conceptEmbeddings[index] ?? []),
    );
    return {
      concept,
      similarity,
      matched: similarity >= CONCEPT_MATCH_THRESHOLD,
    };
  });

  const matchedConcepts = conceptMatches.filter((row) => row.matched).map((row) => row.concept);
  const missingConcepts = conceptMatches.filter((row) => !row.matched).map((row) => row.concept);
  const conceptCoverageScore =
    conceptMatches.length > 0
      ? conceptMatches.reduce((sum, row) => sum + row.similarity, 0) / conceptMatches.length
      : idealSimilarity;

  const partialCredit = classifyPartialCredit(
    idealSimilarity,
    conceptCoverageScore,
    matchedConcepts.length,
    concepts.length,
  );

  const suggestedScores = buildSuggestedScores({
    idealSimilarity,
    conceptCoverageScore,
    partialCredit,
  });

  return {
    preprocessedAnswer: preprocessed.cleaned,
    removedFillerCount: preprocessed.removedFillerCount,
    idealSimilarity,
    conceptCoverageScore,
    concepts: conceptMatches,
    matchedConcepts,
    missingConcepts,
    partialCredit,
    suggestedScores,
    scoringReasons: buildScoringReasons({
      idealSimilarity,
      conceptCoverageScore,
      matchedConcepts,
      missingConcepts,
      partialCredit,
      removedFillerCount: preprocessed.removedFillerCount,
    }),
  };
}

export function blendCategoryScores(
  llmScores: SemanticEvaluationResult["suggestedScores"],
  semanticScores: SemanticEvaluationResult["suggestedScores"],
  semanticWeight = 0.35,
): SemanticEvaluationResult["suggestedScores"] {
  const llmWeight = 1 - semanticWeight;

  const blend = (llm: number, semantic: number) =>
    Math.max(0, Math.min(10, Math.round(llm * llmWeight + semantic * semanticWeight)));

  return {
    technical_correctness: blend(llmScores.technical_correctness, semanticScores.technical_correctness),
    completeness: blend(llmScores.completeness, semanticScores.completeness),
    relevance: blend(llmScores.relevance, semanticScores.relevance),
    communication_clarity: blend(llmScores.communication_clarity, semanticScores.communication_clarity),
    problem_solving: blend(llmScores.problem_solving, semanticScores.problem_solving),
  };
}

export function formatSemanticContextForPrompt(semantic: SemanticEvaluationResult): string {
  const lines = [
    "SEMANTIC ANALYSIS (embedding-based, pre-computed — use as objective signal):",
    `- Ideal-answer similarity: ${Math.round(semantic.idealSimilarity * 100)}%`,
    `- Concept coverage: ${Math.round(semantic.conceptCoverageScore * 100)}%`,
    `- Partial credit level: ${semantic.partialCredit}`,
    `- Matched concepts: ${semantic.matchedConcepts.length ? semantic.matchedConcepts.join("; ") : "none"}`,
    `- Missing concepts: ${semantic.missingConcepts.length ? semantic.missingConcepts.join("; ") : "none"}`,
    "Scoring reasons from semantic engine:",
    ...semantic.scoringReasons.map((reason) => `  • ${reason}`),
    "",
    "Preprocessed candidate answer (fillers removed):",
    semantic.preprocessedAnswer || "(empty)",
  ];
  return lines.join("\n");
}
