import { z } from "zod";
import { extractResponsesOutputText } from "@/lib/openai-responses";
import { env } from "@/lib/env";
import { getScoringModel } from "@/lib/scoring";
import type { NormalizedQuestionInput, QuestionRecord } from "@/lib/interview-questions";
import { questionHasGradingKey } from "@/lib/interview-questions";

export type IdealAnswerContext = {
  role: string;
  jobDescription?: string | null;
  keySkills?: string[];
  domain?: string | null;
  topic?: string | null;
  /**
   * Short excerpt around when this question was asked (set per-call for session grading).
   * Not copied into the ideal — only disambiguates follow-ups and scope.
   */
  interviewTranscriptSnippet?: string | null;
};

const itemSchema = z.object({
  prompt: z.string(),
  expectedAnswer: z.string().min(10),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

const responseSchema = z.object({
  items: z.array(itemSchema),
});

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          prompt: { type: "string" },
          expectedAnswer: { type: "string" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
        },
        required: ["prompt", "expectedAnswer", "difficulty"],
      },
    },
  },
  required: ["items"],
} as const;

const MAX_SNIPPET_CHARS = 900;

function normalizeForMatch(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Ensures every transcript question can be graded even if the LLM ideal-answer call fails. */
export function buildFallbackIdealAnswer(prompt: string, role: string): string {
  const trimmed = prompt.trim().slice(0, 400);
  return `A strong ${role} answer to this question should directly address: ${trimmed}. Include specific examples, relevant technical or domain knowledge, clear structure, and outcomes or impact where applicable.`;
}

/**
 * Local transcript window around when this question was asked (ideal-answer context only).
 */
export function buildTranscriptSnippetAroundQuestion(
  turns: Array<{ speaker: string; message: string }>,
  questionPrompt: string,
): string | null {
  if (!turns.length || !questionPrompt.trim()) return null;
  const normQ = normalizeForMatch(questionPrompt);
  const keywords = normQ
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 12);
  if (keywords.length === 0) return null;

  let bestIdx = -1;
  let bestScore = 0;
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i]!;
    if (t.speaker.toUpperCase() !== "INTERVIEWER") continue;
    const m = normalizeForMatch(t.message);
    let score = 0;
    for (const w of keywords) {
      if (m.includes(w)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  let startIdx = bestIdx >= 0 ? bestIdx : turns.findIndex((t) => t.speaker.toUpperCase() === "INTERVIEWER");
  if (startIdx < 0) startIdx = 0;

  const chunks: string[] = [];
  let total = 0;
  for (let j = startIdx; j < turns.length && total < MAX_SNIPPET_CHARS; j++) {
    const speaker = turns[j]!.speaker.toUpperCase() === "INTERVIEWER" ? "INTERVIEWER" : "CANDIDATE";
    const line = `${speaker}: ${turns[j]!.message.trim()}`;
    if (total + line.length + 1 > MAX_SNIPPET_CHARS) break;
    chunks.push(line);
    total += line.length + 1;
    if (j > startIdx && speaker === "INTERVIEWER" && chunks.length >= 5) break;
  }
  return chunks.length ? chunks.join("\n") : null;
}

function buildPrompt(
  context: IdealAnswerContext,
  questions: Array<{ prompt: string; isMandatory: boolean }>,
): string {
  const jd = context.jobDescription?.trim() || "Not provided";
  const skills =
    context.keySkills?.length ? context.keySkills.map((s) => `- ${s}`).join("\n") : "Not provided";
  const list = questions
    .map((q, i) => `${i + 1}. [${q.isMandatory ? "mandatory" : "optional"}] ${q.prompt}`)
    .join("\n");

  const snippet = context.interviewTranscriptSnippet?.trim();

  const parts = [
    "You are an expert interviewer preparing GRADING REFERENCE answers (not scripts for the candidate).",
    "For each question below, write an IDEAL ANSWER that a strong candidate SHOULD give.",
    "",
    "Rules:",
    "- Address ONLY what that specific question asks. Do not answer a different topic.",
    "- Match intent, depth, and seniority for the ROLE.",
    "- Use job description and key skills when relevant; stay concrete (no vague fluff).",
    "- Return the same question prompt text exactly as provided (for mapping).",
    "- difficulty: easy | medium | hard from question complexity.",
    "",
    "Length and style (pick ONE style per question from its wording):",
    "- FACTUAL / DEFINITION / FULL FORM / YES-NO (e.g. full form of HTML, what is X, define Y):",
    "  Give the direct correct answer in 1–2 short sentences max. State the fact first.",
    "  Example: Q: full form of HTML → Ideal: HTML stands for Hyper Text Markup Language.",
    "- BEHAVIORAL / EXPERIENCE / BACKGROUND / ROLE FIT (e.g. tell me about yourself, how you map to this role):",
    "  One tight paragraph plus optional 3–5 bullets covering: relevant background, concrete examples,",
    "  cross-functional or product/technical work, and explicit tie-in to this ROLE.",
    "- TECHNICAL / HOW / DESIGN (explain, compare, trade-offs):",
    "  3–6 sentences or tight bullets with accurate technical detail; no generic filler.",
    "- Never pad with generic interview fluff. Never answer a different question than asked.",
  ];

  if (snippet) {
    parts.push(
      "",
      "INTERVIEW EXCERPT (what was said near this question in the real interview):",
      snippet,
      "",
      "Use this excerpt ONLY to sharpen scope (e.g. follow-ups, which subtopic).",
      "Do NOT copy or paraphrase the candidate. Do NOT treat the excerpt as the ideal answer.",
    );
  }

  parts.push(
    "",
    `Role: ${context.role}`,
    `Domain: ${context.domain ?? context.role}`,
    `Topic summary: ${context.topic ?? "Interview"}`,
    `Key skills:\n${skills}`,
    "",
    "Job description:",
    jd,
    "",
    "Questions:",
    list,
    "",
    'Return JSON: { "items": [{ "prompt": "...", "expectedAnswer": "...", "difficulty": "medium" }] }',
  );

  return parts.join("\n");
}

async function callOpenAiForIdealAnswers(
  context: IdealAnswerContext,
  questions: Array<{ prompt: string; isMandatory: boolean }>,
): Promise<z.infer<typeof responseSchema> | null> {
  if (!env.openAiApiKey || questions.length === 0) return null;

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
          content: [{ type: "input_text", text: buildPrompt(context, questions) }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ideal_answers",
          strict: true,
          schema: jsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ideal answer generation failed: ${await response.text()}`);
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  const outputText = extractResponsesOutputText(payload);
  if (!outputText) return null;
  const parsed = responseSchema.safeParse(JSON.parse(outputText));
  return parsed.success ? parsed.data : null;
}

function firstItemForPrompt(
  prompt: string,
  items: z.infer<typeof responseSchema>["items"],
): { expectedAnswer: string; difficulty?: "easy" | "medium" | "hard" } | null {
  const normalized = prompt.trim().toLowerCase();
  const exact = items.find((item) => item.prompt.trim().toLowerCase() === normalized);
  if (exact?.expectedAnswer) {
    return { expectedAnswer: exact.expectedAnswer.trim(), difficulty: exact.difficulty };
  }
  if (items[0]?.expectedAnswer) {
    return { expectedAnswer: items[0].expectedAnswer.trim(), difficulty: items[0].difficulty };
  }
  return null;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    for (;;) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!);
    }
  }

  const n = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

export type FillIdealAnswersOptions = {
  transcriptTurns?: Array<{ speaker: string; message: string }>;
  concurrency?: number;
};

type IdealOneResult = {
  prompt: string;
  expectedAnswer: string | null;
  difficulty?: "easy" | "medium" | "hard";
};

async function generateIdealForSingleQuestion(input: {
  prompt: string;
  isMandatory: boolean;
  baseContext: IdealAnswerContext;
  transcriptTurns?: Array<{ speaker: string; message: string }>;
}): Promise<IdealOneResult> {
  const snippet =
    input.transcriptTurns?.length
      ? buildTranscriptSnippetAroundQuestion(input.transcriptTurns, input.prompt)
      : null;
  const ctx: IdealAnswerContext = { ...input.baseContext, interviewTranscriptSnippet: snippet };

  const generated = await callOpenAiForIdealAnswers(ctx, [{ prompt: input.prompt, isMandatory: input.isMandatory }]);
  if (!generated?.items.length) return { prompt: input.prompt, expectedAnswer: null };
  const hit = firstItemForPrompt(input.prompt, generated.items);
  return { prompt: input.prompt, expectedAnswer: hit?.expectedAnswer ?? null, difficulty: hit?.difficulty };
}

/** Fill missing expectedAnswer on normalized question inputs (e.g. requirement save). One API call per question. */
export async function fillMissingIdealAnswersOnInputs(
  mandatory: NormalizedQuestionInput[],
  optional: NormalizedQuestionInput[],
  context: IdealAnswerContext,
  options?: Pick<FillIdealAnswersOptions, "concurrency">,
): Promise<{ mandatory: NormalizedQuestionInput[]; optional: NormalizedQuestionInput[] }> {
  const concurrency = Math.max(1, Math.min(8, options?.concurrency ?? 3));
  const needs = [...mandatory, ...optional].filter((q) => !questionHasGradingKey(q));
  if (!needs.length) return { mandatory, optional };

  try {
    const results = await mapWithConcurrency(needs, concurrency, async (q) => {
      const isMandatory = mandatory.some((m) => m.prompt === q.prompt);
      return generateIdealForSingleQuestion({ prompt: q.prompt, isMandatory, baseContext: context });
    });
    const byPrompt = new Map(results.map((r) => [r.prompt, r]));
    const enrich = (items: NormalizedQuestionInput[]) =>
      items.map((item) => {
        if (item.expectedAnswer?.trim()) return item;
        const row = byPrompt.get(item.prompt);
        if (!row?.expectedAnswer?.trim()) return item;
        return { ...item, expectedAnswer: row.expectedAnswer, difficulty: row.difficulty ?? item.difficulty };
      });
    return { mandatory: enrich(mandatory), optional: enrich(optional) };
  } catch (error) {
    console.error("[generate-ideal-answers] fillMissingIdealAnswersOnInputs failed:", error);
    return { mandatory, optional };
  }
}

/** Fill missing expectedAnswer on question records (e.g. interview complete grading). */
export async function fillMissingIdealAnswersOnRecords(
  questions: QuestionRecord[],
  context: IdealAnswerContext,
  options?: FillIdealAnswersOptions,
): Promise<QuestionRecord[]> {
  const missing = questions.filter((q) => !questionHasGradingKey(q));
  if (!missing.length) return questions;

  const byPromptKey = new Map<string, IdealOneResult>();
  const BATCH_SIZE = 8;

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    try {
      const generated = await callOpenAiForIdealAnswers(
        context,
        batch.map((q) => ({ prompt: q.prompt, isMandatory: q.isMandatory })),
      );
      if (generated?.items.length) {
        for (const item of generated.items) {
          if (!item.expectedAnswer?.trim()) continue;
          byPromptKey.set(normalizeForMatch(item.prompt), {
            prompt: item.prompt,
            expectedAnswer: item.expectedAnswer.trim(),
            difficulty: item.difficulty,
          });
        }
      }
    } catch (error) {
      console.error("[generate-ideal-answers] batch ideal answers failed:", error);
    }

    const concurrency = Math.max(1, Math.min(8, options?.concurrency ?? 3));
    const stillMissing = batch.filter((q) => !byPromptKey.has(normalizeForMatch(q.prompt)));
    if (stillMissing.length > 0) {
      const singles = await mapWithConcurrency(stillMissing, concurrency, async (q) =>
        generateIdealForSingleQuestion({
          prompt: q.prompt,
          isMandatory: q.isMandatory,
          baseContext: context,
          transcriptTurns: options?.transcriptTurns,
        }),
      );
      for (const row of singles) {
        if (!row.expectedAnswer?.trim()) continue;
        byPromptKey.set(normalizeForMatch(row.prompt), row);
      }
    }
  }

  return questions.map((q) => {
    if (questionHasGradingKey(q)) return q;
    const row = byPromptKey.get(normalizeForMatch(q.prompt));
    if (row?.expectedAnswer?.trim()) {
      return { ...q, expectedAnswer: row.expectedAnswer, difficulty: row.difficulty ?? q.difficulty };
    }
    return {
      ...q,
      expectedAnswer: buildFallbackIdealAnswer(q.prompt, context.role),
      difficulty: q.difficulty,
    };
  });
}