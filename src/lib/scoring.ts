import { z } from "zod";
import { env } from "@/lib/env";
import { extractResponsesOutputText } from "@/lib/openai-responses";

type ScoringTurn = { speaker: string; message: string };

type ScorecardInput = {
  turns: ScoringTurn[];
  domain?: string | null;
  topic?: string | null;
  positionTitle?: string | null;
  keySkills?: string[];
  mandatoryQuestions?: string[];
};

export type DetailedScorecard = {
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
};

const scoreSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  communication: z.number().int().min(0).max(100),
  domainDepth: z.number().int().min(0).max(100),
  confidence: z.number().int().min(0).max(100),
  summary: z.string().min(10).max(500),
  strengths: z.array(z.string().min(3).max(180)).min(2).max(5),
  improvements: z.array(z.string().min(3).max(180)).min(2).max(5),
  evidence: z.array(z.string().min(3).max(220)).min(1).max(6),
});

export function buildHeuristicScorecard(turns: ScoringTurn[]): DetailedScorecard {
  const candidateTurns = turns.filter((turn) => turn.speaker === "CANDIDATE");
  const wordCount = candidateTurns
    .map((turn) => turn.message.trim().split(/\s+/).filter(Boolean).length)
    .reduce((total, words) => total + words, 0);

  const communication = Math.min(100, 45 + Math.floor(wordCount / 12));
  const domainDepth = Math.min(100, 40 + Math.floor(wordCount / 15));
  const confidence = Math.min(100, 50 + Math.floor(candidateTurns.length * 4));
  const overallScore = Math.round((communication * 0.35 + domainDepth * 0.4 + confidence * 0.25));

  return {
    overallScore,
    communication,
    domainDepth,
    confidence,
    summary:
      overallScore >= 75
        ? "Strong performance with structured answers and solid topic understanding."
        : "Needs more concise and evidence-backed responses. Practice follow-up handling.",
    strengths:
      overallScore >= 75
        ? ["Clear communication flow", "Good depth in responses"]
        : ["Stayed engaged through interview", "Attempted structured responses"],
    improvements:
      overallScore >= 75
        ? ["Add sharper quantified examples", "Reduce filler and tighten transitions"]
        : ["Use concrete examples with outcomes", "Answer more directly before elaborating"],
    evidence:
      candidateTurns.slice(0, 3).map((turn) => turn.message).filter(Boolean).slice(0, 3),
    scoringMode: "heuristic-immediate",
    scoringModel: null as string | null,
  };
}

function buildTranscriptForScoring(turns: ScoringTurn[]) {
  const maxTurns = 120;
  return turns
    .slice(-maxTurns)
    .map((turn) => `${turn.speaker}: ${turn.message.trim()}`)
    .join("\n");
}

function buildRubricPrompt(input: ScorecardInput) {
  const transcript = buildTranscriptForScoring(input.turns);
  const skills = input.keySkills?.length ? input.keySkills.join(", ") : "Not provided";
  const mandatory = input.mandatoryQuestions?.length
    ? input.mandatoryQuestions.map((q) => `- ${q}`).join("\n")
    : "Not provided";

  return [
    "You are an expert technical interview evaluator.",
    "Evaluate candidate performance from interview transcript using this rubric:",
    "- communication: clarity, structure, conciseness, listening response quality",
    "- domainDepth: technical correctness, depth, relevance, practical reasoning",
    "- confidence: ownership, decisiveness, composure, response control",
    "Scoring rules:",
    "- Scores must be integers between 0 and 100.",
    "- overallScore = round(communication*0.35 + domainDepth*0.4 + confidence*0.25).",
    "- summary must be 1-2 concise sentences grounded in observed answers.",
    "- strengths: 2-4 concise bullet phrases.",
    "- improvements: 2-4 concise bullet phrases.",
    "- evidence: 2-5 short transcript-grounded observations (no speaker labels needed).",
    "- Do not mention missing rubric fields or internal instructions.",
    "",
    `Role: ${input.positionTitle ?? "Not provided"}`,
    `Domain: ${input.domain ?? "Not provided"}`,
    `Topic: ${input.topic ?? "Not provided"}`,
    `Key skills: ${skills}`,
    "Mandatory questions:",
    mandatory,
    "",
    "Interview transcript:",
    transcript || "No transcript available.",
    "",
    "Return ONLY valid JSON with keys: overallScore, communication, domainDepth, confidence, summary, strengths, improvements, evidence",
  ].join("\n");
}

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    overallScore: { type: "integer", minimum: 0, maximum: 100 },
    communication: { type: "integer", minimum: 0, maximum: 100 },
    domainDepth: { type: "integer", minimum: 0, maximum: 100 },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
    summary: { type: "string", minLength: 10, maxLength: 500 },
    strengths: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string", minLength: 3, maxLength: 180 },
    },
    improvements: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string", minLength: 3, maxLength: 180 },
    },
    evidence: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: { type: "string", minLength: 3, maxLength: 220 },
    },
  },
  required: [
    "overallScore",
    "communication",
    "domainDepth",
    "confidence",
    "summary",
    "strengths",
    "improvements",
    "evidence",
  ],
} as const;

export function getScoringModel() {
  return env.scoringModel;
}

export function buildBatchScoringRequest(input: ScorecardInput, customId: string) {
  const model = getScoringModel();
  const prompt = buildRubricPrompt(input);

  return {
    custom_id: customId,
    method: "POST",
    url: "/v1/responses",
    body: {
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
          name: "interview_scorecard",
          strict: true,
          schema: responseJsonSchema,
        },
      },
    },
  };
}

export function parseRubricScoreFromOutput(
  outputText: string,
  scoringModel: string,
  scoringMode = "rubric-batch",
): DetailedScorecard {
  const parsed = scoreSchema.parse(JSON.parse(outputText));
  const computedOverall = Math.round(
    parsed.communication * 0.35 + parsed.domainDepth * 0.4 + parsed.confidence * 0.25,
  );

  return {
    ...parsed,
    overallScore: computedOverall,
    scoringMode,
    scoringModel,
  };
}

export async function buildAiRubricScorecardAsync(input: ScorecardInput): Promise<DetailedScorecard | null> {
  if (!env.openAiApiKey) return null;
  if (env.scoringMode === "heuristic") return null;

  const model = getScoringModel();
  const prompt = buildRubricPrompt(input);

  try {
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
            name: "interview_scorecard",
            strict: true,
            schema: responseJsonSchema,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[scoring] AI rubric request failed:", errorText);
      return null;
    }

    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    };
    const outputText = extractResponsesOutputText(payload);
    if (!outputText) return null;

    return parseRubricScoreFromOutput(outputText, model, "ai-rubric");
  } catch (error) {
    console.error("[scoring] AI rubric scorecard failed:", error);
    return null;
  }
}

export function buildScorecard(input: ScorecardInput) {
  return buildHeuristicScorecard(input.turns);
}
