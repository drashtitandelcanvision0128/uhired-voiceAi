import type { TranscriptQAPair, TranscriptTurn } from "@/lib/extract-transcript-qa";

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "at",
  "for",
  "you",
  "your",
  "me",
  "my",
  "can",
  "could",
  "would",
  "tell",
  "about",
  "when",
  "how",
  "what",
  "why",
  "where",
  "that",
  "this",
  "with",
  "from",
  "have",
  "has",
  "had",
  "been",
  "were",
  "was",
  "are",
  "is",
  "do",
  "did",
  "does",
]);

function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantWords(text: string): string[] {
  return normalizeQuestionText(text)
    .split(" ")
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Fuzzy match between an agenda question and text spoken in the transcript.
 */
export function agendaQuestionMatchesTranscriptText(agendaPrompt: string, spokenText: string): boolean {
  const agenda = normalizeQuestionText(agendaPrompt);
  const spoken = normalizeQuestionText(spokenText);
  if (!agenda || !spoken) return false;
  if (agenda === spoken) return true;
  if (spoken.includes(agenda) || agenda.includes(spoken)) return true;

  const agendaWords = significantWords(agendaPrompt);
  const spokenWords = new Set(significantWords(spokenText));
  if (agendaWords.length === 0) return false;

  const overlap = agendaWords.filter((word) => spokenWords.has(word)).length;
  const ratio = overlap / agendaWords.length;
  return ratio >= 0.55;
}

export type AgendaQuestionTranscriptMatch = {
  asked: boolean;
  candidateAnswer: string;
  matchedQuestionText: string | null;
};

function collectCandidateAnswerAfterInterviewerTurn(
  turns: TranscriptTurn[],
  interviewerIndex: number,
): string {
  const chunks: string[] = [];
  for (let i = interviewerIndex + 1; i < turns.length; i += 1) {
    const turn = turns[i]!;
    if (turn.speaker.toUpperCase() === "INTERVIEWER") break;
    if (turn.speaker.toUpperCase() === "CANDIDATE") {
      const text = turn.message.trim();
      if (text) chunks.push(text);
    }
  }
  return chunks.join(" ").trim();
}

/** True when the candidate said anything in response (even brief). */
export function candidateSpokeInTranscript(answer: string): boolean {
  return answer.trim().length > 0;
}

/**
 * Determine whether an agenda question was actually asked in the interview and,
 * if so, what the candidate answered.
 */
export function matchAgendaQuestionToTranscript(input: {
  agendaPrompt: string;
  pairs: TranscriptQAPair[];
  turns: TranscriptTurn[];
}): AgendaQuestionTranscriptMatch {
  const pairMatch = input.pairs.find((pair) =>
    agendaQuestionMatchesTranscriptText(input.agendaPrompt, pair.question),
  );
  if (pairMatch) {
    return {
      asked: true,
      candidateAnswer: pairMatch.candidateAnswer,
      matchedQuestionText: pairMatch.question,
    };
  }

  const interviewerIndex = input.turns.findIndex(
    (turn) =>
      turn.speaker.toUpperCase() === "INTERVIEWER" &&
      agendaQuestionMatchesTranscriptText(input.agendaPrompt, turn.message),
  );
  if (interviewerIndex >= 0) {
    const interviewerMatch = input.turns[interviewerIndex]!;
    return {
      asked: true,
      candidateAnswer: collectCandidateAnswerAfterInterviewerTurn(input.turns, interviewerIndex),
      matchedQuestionText: interviewerMatch.message,
    };
  }

  return {
    asked: false,
    candidateAnswer: "",
    matchedQuestionText: null,
  };
}

function positionalTranscriptPair(
  questionIndex: number,
  questionCount: number,
  pairs: TranscriptQAPair[],
): TranscriptQAPair | null {
  if (!pairs.length) return null;
  if (questionCount === 1) return pairs[0] ?? null;
  if (pairs.length === questionCount) return pairs[questionIndex] ?? null;
  if (questionIndex < pairs.length) return pairs[questionIndex] ?? null;
  return null;
}

/**
 * Map an agenda question to the candidate's transcript answer.
 * The live interviewer often paraphrases agenda prompts, so we try:
 * 1) LLM / heuristic alignment by question id
 * 2) fuzzy text match against transcript
 * 3) positional Q&A pair when counts line up (common for single-question interviews)
 */
export function resolveAgendaQuestionAnswer(input: {
  agendaPrompt: string;
  questionIndex: number;
  questionCount: number;
  pairs: TranscriptQAPair[];
  turns: TranscriptTurn[];
  alignedAnswer?: string;
}): AgendaQuestionTranscriptMatch {
  const aligned = input.alignedAnswer?.trim() ?? "";
  if (aligned) {
    return {
      asked: true,
      candidateAnswer: aligned,
      matchedQuestionText: null,
    };
  }

  const fuzzy = matchAgendaQuestionToTranscript({
    agendaPrompt: input.agendaPrompt,
    pairs: input.pairs,
    turns: input.turns,
  });
  if (fuzzy.asked) return fuzzy;

  const positional = positionalTranscriptPair(input.questionIndex, input.questionCount, input.pairs);
  if (positional) {
    return {
      asked: true,
      candidateAnswer: positional.candidateAnswer,
      matchedQuestionText: positional.question,
    };
  }

  return {
    asked: false,
    candidateAnswer: "",
    matchedQuestionText: null,
  };
}
