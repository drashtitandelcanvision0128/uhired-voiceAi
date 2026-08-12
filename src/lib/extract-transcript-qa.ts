import { z } from "zod";
import { extractResponsesOutputText } from "@/lib/openai-responses";
import { env } from "@/lib/env";
import { getScoringModel } from "@/lib/scoring";

export type TranscriptTurn = { speaker: string; message: string };

/**
 * Detect if a text looks like a question (interviewer) or answer (candidate)
 */
function isLikelyQuestion(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  const questionIndicators = [
    /\?/,
    /^(can you|could you|would you|tell me|describe|walk me through|how do|how did|how would|what is|what are|what was|why |when |where |explain)/i,
  ];
  return questionIndicators.some(pattern => pattern.test(trimmed)) && trimmed.length >= 10;
}

/**
 * Detect if a text looks like a personal answer (candidate)
 */
function isLikelyAnswer(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  const answerIndicators = [
    /^(i|i'm|i have|i did|i have worked|i worked|i was|my experience|in my role)/i,
    /^(we|our team|our company)/i,
  ];
  return answerIndicators.some(pattern => pattern.test(trimmed)) && trimmed.length >= 10;
}

/**
 * Detect and correct speaker mismatches in transcript based on content analysis
 */
export function correctSpeakerMismatchesInTranscript(turns: TranscriptTurn[]): TranscriptTurn[] {
  const corrected = [...turns];
  
  for (let i = 0; i < corrected.length; i++) {
    const turn = corrected[i];
    const text = turn.message.trim();
    
    // Skip very short texts or empty content
    if (text.length < 10) continue;
    
    const isQuestion = isLikelyQuestion(text);
    const isAnswer = isLikelyAnswer(text);
    const speaker = turn.speaker.toUpperCase();
    
    // If content strongly suggests a different speaker, swap the label
    if (speaker === "CANDIDATE" && isQuestion && !isAnswer) {
      // Candidate text looks like a question - likely mislabeled
      corrected[i] = { ...turn, speaker: "INTERVIEWER" };
    } else if (speaker === "INTERVIEWER" && isAnswer && !isQuestion) {
      // Interviewer text looks like a personal answer - likely mislabeled
      corrected[i] = { ...turn, speaker: "CANDIDATE" };
    }
  }
  
  return corrected;
}

export type TranscriptQAPair = {
  question: string;
  candidateAnswer: string;
};

const pairSchema = z.object({
  question: z.string().min(8),
  candidateAnswer: z.string(),
});

const extractResponseSchema = z.object({
  pairs: z.array(pairSchema),

});

const extractJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    pairs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question: { type: "string" },
          candidateAnswer: { type: "string" },
        },
        required: ["question", "candidateAnswer"],
      },
    },
  },
  required: ["pairs"],
} as const;

function buildTranscriptBlock(turns: TranscriptTurn[]): string {
  return turns
    .map((turn, index) => {
      const speaker = turn.speaker.toUpperCase() === "INTERVIEWER" ? "INTERVIEWER" : "CANDIDATE";
      return `${index + 1}. ${speaker}: ${turn.message.trim()}`;
    })
    .join("\n");
}

const QUESTION_STARTER =
  /\b(can you|could you|would you|tell me|describe|walk me through|how do|how did|how would|what is|what are|what was|why |when |where |explain)\b/i;

function isSubstantiveQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 12) return false;
  const lower = trimmed.toLowerCase();

  if (/^(take care|best of luck|goodbye|see you)/i.test(lower)) return false;
  if (
    /^(got it|understood|thanks|thank you|great|good approach|that makes sense|perfect|wonderful)[.!,]?\s*$/i.test(
      lower,
    )
  ) {
    return false;
  }

  if (trimmed.includes("?")) return true;
  return QUESTION_STARTER.test(lower) && trimmed.length >= 28;
}

function normalizePairQuestion(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function pairQuestionsSimilar(a: string, b: string): boolean {
  const left = normalizePairQuestion(a);
  const right = normalizePairQuestion(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  const leftWords = left.split(" ").filter((w) => w.length > 3);
  const rightSet = new Set(right.split(" ").filter((w) => w.length > 3));
  if (!leftWords.length) return false;
  const overlap = leftWords.filter((w) => rightSet.has(w)).length;
  return overlap / leftWords.length >= 0.6;
}

/** Merge multiple extraction passes, keeping the longer candidate answer when duplicate questions appear. */
export function mergeTranscriptQAPairs(...lists: TranscriptQAPair[][]): TranscriptQAPair[] {
  const merged: TranscriptQAPair[] = [];
  for (const list of lists) {
    for (const pair of list) {
      const question = pair.question.trim();
      if (!question || !isSubstantiveQuestion(question)) continue;
      const existing = merged.find((row) => pairQuestionsSimilar(row.question, question));
      if (!existing) {
        merged.push({ question, candidateAnswer: pair.candidateAnswer.trim() });
        continue;
      }
      if (pair.candidateAnswer.trim().length > existing.candidateAnswer.length) {
        existing.candidateAnswer = pair.candidateAnswer.trim();
      }
    }
  }
  return merged;
}

/** Split one interviewer turn that may contain multiple questions. */
function extractQuestionsFromInterviewerTurn(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const segments = trimmed
    .split(/(?<=\?)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (segments.length > 1) {
    const substantive = segments.filter(isSubstantiveQuestion);
    if (substantive.length > 0) return substantive;
  }

  return isSubstantiveQuestion(trimmed) ? [trimmed] : [];
}

/** Prefer the actual question sentence inside a long interviewer turn. */
function extractQuestionFromInterviewerTurn(text: string): string {
  return text.trim();
}

/** Split transcript into interviewer questions and following candidate answer(s). */
export function heuristicExtractQAPairs(turns: TranscriptTurn[]): TranscriptQAPair[] {
  const pairs: TranscriptQAPair[] = [];
  let currentQuestion: string | null = null;
  let currentAnswers: string[] = [];

  const flush = () => {
    const q = currentQuestion?.trim();
    const a = currentAnswers.join(" ").trim();
    if (q && isSubstantiveQuestion(q)) {
      pairs.push({ question: q, candidateAnswer: a });
    }
    currentQuestion = null;
    currentAnswers = [];
  };

  for (const turn of turns) {
    const isInterviewer = turn.speaker.toUpperCase() === "INTERVIEWER";
    const text = turn.message.trim();
    if (!text) continue;

    if (isInterviewer) {
      if (currentQuestion) {
        flush();
      }

      const questionsInTurn = extractQuestionsFromInterviewerTurn(text);
      if (questionsInTurn.length > 1) {
        for (let qi = 0; qi < questionsInTurn.length - 1; qi += 1) {
          pairs.push({ question: questionsInTurn[qi]!, candidateAnswer: "" });
        }
        currentQuestion = questionsInTurn[questionsInTurn.length - 1] ?? null;
        continue;
      }

      const questionText = extractQuestionFromInterviewerTurn(text);
      if (isSubstantiveQuestion(questionText)) {
        currentQuestion = questionText;
      }
    } else if (currentQuestion) {
      currentAnswers.push(text);
    }
  }
  flush();
  return pairs;
}

async function callOpenAiExtract(prompt: string): Promise<TranscriptQAPair[] | null> {
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
          name: "transcript_qa_pairs",
          strict: true,
          schema: extractJsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    console.error("[extract-transcript-qa] API error:", await response.text());
    return null;
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  const outputText = extractResponsesOutputText(payload);
  if (!outputText) return null;

  const parsed = extractResponseSchema.safeParse(JSON.parse(outputText));
  if (!parsed.success) return null;

  return parsed.data.pairs
    .map((row) => ({
      question: extractQuestionFromInterviewerTurn(row.question),
      candidateAnswer: row.candidateAnswer.trim(),
    }))
    .filter((row) => isSubstantiveQuestion(row.question));
}

/**
 * Extract every substantive Q&A from the interview transcript.
 */
export async function extractQAPairsFromTranscript(turns: TranscriptTurn[]): Promise<TranscriptQAPair[]> {
  if (!turns.length) return [];

  const correctedTurns = correctSpeakerMismatchesInTranscript(turns);
  const heuristic = heuristicExtractQAPairs(correctedTurns);
  if (!env.openAiApiKey) return heuristic;

  const transcript = buildTranscriptBlock(correctedTurns);
  const prompt = [
    "Extract EVERY substantive interview question and the candidate's answer from this transcript.",
    "Rules:",
    "- One pair per distinct question the interviewer asked (include all follow-ups and rephrased questions).",
    "- Do not collapse multiple questions into one pair unless they were asked in a single breath without a candidate reply between them.",
    "- question: MUST be the EXACT exact wording of the interviewer's turn as it appears in the transcript. Do not edit, shorten, summarize, or alter it in any way. Include all sentences spoken by the interviewer in that turn.",
    "- candidateAnswer: MUST be the EXACT exact wording of the candidate's answer as it appears in the transcript. Merge multiple candidate turns if necessary but do not change the words.",
    "- Skip pure greetings, sign-offs, and brief acknowledgments (e.g. 'Got it', 'Thank you for sharing') unless they contain a real question.",
    "- Include follow-up questions as separate pairs when the candidate gave a distinct answer.",
    "- Do not invent content not present in the transcript.",
    "- If the candidate did not answer, set candidateAnswer to an empty string.",
    "",
    "Transcript:",
    transcript || "(empty)",
    "",
    'Return JSON: { "pairs": [{ "question": "...", "candidateAnswer": "..." }] }',
  ].join("\n");

  try {
    const extracted = await callOpenAiExtract(prompt);
    return mergeTranscriptQAPairs(heuristic, extracted ?? []);
  } catch (error) {
    console.error("[extract-transcript-qa] extract failed:", error);
    return heuristic;
  }
}
