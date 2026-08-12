import { type QuestionRecord, getQuestionsForGrading } from "@/lib/interview-questions";
import {
  extractQAPairsFromTranscript,
  type TranscriptTurn,
  type TranscriptQAPair,
} from "@/lib/extract-transcript-qa";

/** Transcript Q&A → grading rows; ideal answers are generated later (never copied from admin list). */
function pairsToQuestionRecords(
  pairs: TranscriptQAPair[],
): { questions: QuestionRecord[]; prefilledAnswers: Map<string, string> } {
  const prefilledAnswers = new Map<string, string>();
  const questions: QuestionRecord[] = [];

  pairs.forEach((pair, index) => {
    const id = `txq-${index}`;
    prefilledAnswers.set(id, pair.candidateAnswer);

    questions.push({
      id,
      prompt: pair.question,
      isMandatory: true,
      orderIndex: index,
      expectedAnswer: null,
      gradingRubric: null,
      difficulty: "medium",
    });
  });

  return { questions, prefilledAnswers };
}

/** When transcript has no extractable Q&A, fall back to admin topic list (ideals still generated fresh). */
function agendaFallbackQuestions(
  agendaQuestions: QuestionRecord[],
  pickedOptionalIds?: string[] | null,
): QuestionRecord[] {
  const agenda = getQuestionsForGrading(agendaQuestions, pickedOptionalIds);
  return agenda.map((q) => ({
    ...q,
    expectedAnswer: null,
  }));
}

export type GradingQuestionsResolution = {
  questions: QuestionRecord[];
  prefilledAnswers: Map<string, string>;
};

/**
 * Build questions to grade from the interview transcript (what was actually asked).
 * Admin mandatory/optional lists are only used if the transcript yields no Q&A pairs.
 */
export async function resolveGradingQuestionsForSession(input: {
  turns: TranscriptTurn[];
  agendaQuestions: QuestionRecord[];
  pickedOptionalIds?: string[] | null;
}): Promise<GradingQuestionsResolution> {
  const pairs = await extractQAPairsFromTranscript(input.turns);

  if (pairs.length > 0) {
    return pairsToQuestionRecords(pairs);
  }

  return {
    questions: agendaFallbackQuestions(input.agendaQuestions, input.pickedOptionalIds),
    prefilledAnswers: new Map(),
  };
}
