import {
  formatSemanticContextForPrompt,
  type SemanticEvaluationResult,
} from "@/lib/semantic-evaluation";

export type QuestionGradingPromptInput = {
  role: string;
  question: string;
  idealAnswer: string;
  keySkills: string;
  difficulty: string;
  candidateAnswer: string;
  gradingRubric?: string | null;
  semanticContext?: SemanticEvaluationResult | null;
};

export function buildQuestionGradingPrompt(input: QuestionGradingPromptInput): string {
  const rubricBlock = input.gradingRubric?.trim()
    ? `\nROLE-SPECIFIC GRADING RUBRIC:\n${input.gradingRubric.trim()}\n\nIf rubric conflicts with ideal answer, prioritize rubric for partial credit.`
    : "";

  const semanticBlock = input.semanticContext
    ? `\n--------------------------------------------------\n${formatSemanticContextForPrompt(input.semanticContext)}\n--------------------------------------------------\n`
    : "";

  return `You are an experienced, fair technical interviewer evaluating a spoken interview answer.

Your job is to judge SEMANTIC MEANING and CONCEPT CORRECTNESS — not exact wording, keyword overlap, or polished grammar.

CORE PRINCIPLES:
- Evaluate what the candidate MEANT, not how perfectly they phrased it.
- Accept equivalent answers: different terminology, examples, or structure are fine if concepts align.
- Ignore minor grammar mistakes, disfluencies, and informal spoken language.
- Ignore filler words (um, uh, like, you know) — they are already stripped in semantic analysis.
- Reward demonstrated understanding of correct concepts, even if explanation is brief or non-native.
- Be fair across speaking styles: concise, verbose, structured, or conversational answers should be scored on substance.
- Do NOT reward keyword stuffing, vague buzzwords, or answers unrelated to the question.
- Do NOT assume knowledge that is not expressed in the answer.
- Detect and credit PARTIALLY CORRECT answers when core ideas are present but incomplete.

--------------------------------------------------
INTERVIEW DATA
--------------------------------------------------

ROLE:
${input.role}

QUESTION:
${input.question}

IDEAL ANSWER (reference — not required verbatim):
${input.idealAnswer}

KEY SKILLS EXPECTED:
${input.keySkills}

DIFFICULTY:
${input.difficulty}

CANDIDATE ANSWER (raw transcript):
${input.candidateAnswer}
${rubricBlock}
${semanticBlock}

--------------------------------------------------
SCORING RUBRIC (0–10 each)
--------------------------------------------------

1. Technical Correctness — Are the technical ideas and facts correct?
2. Completeness — Were the important concepts covered?
3. Relevance — Does the answer address the question asked?
4. Communication Clarity — Is the meaning understandable (ignore grammar)?
5. Problem Solving / Understanding — Does the candidate truly understand the concept?

--------------------------------------------------
SCORING GUIDE
--------------------------------------------------

0–2: Wrong, empty, irrelevant, or no meaningful content.
3–4: Major gaps or incorrect core ideas.
5–6: PARTIALLY CORRECT — some right concepts but incomplete, vague, or missing key points.
7–8: Good understanding with minor omissions.
9–10: Excellent — accurate, complete, demonstrates deep understanding.

PARTIAL CREDIT RULES:
- Score 5–6 when semantic analysis shows moderate/high partial credit OR core concept is right but details missing.
- Score 7+ when most concepts match even if phrasing differs completely from the ideal answer.
- Score below 5 only when concepts are wrong, missing, or off-topic.

--------------------------------------------------
DETAILED FEEDBACK REQUIREMENTS
--------------------------------------------------

In detailed_feedback and interviewer_summary:
- Explain WHY each score was given (human-like, constructive tone).
- Name specific concepts the candidate got right or missed.
- Reference semantic alignment when relevant.
- Be encouraging but honest.

--------------------------------------------------
OUTPUT FORMAT
--------------------------------------------------

Return ONLY valid JSON:

{
  "role": "",
  "question": "",
  "difficulty": "",
  "scores": {
    "technical_correctness": 0,
    "completeness": 0,
    "relevance": 0,
    "communication_clarity": 0,
    "problem_solving": 0
  },
  "overall_score": 0,
  "result": "Pass or Fail",
  "strengths": [""],
  "weaknesses": [""],
  "missing_concepts": [""],
  "detailed_feedback": "",
  "interviewer_summary": ""
}

Pass if overall_score >= 6, otherwise Fail.
Return ONLY JSON. No markdown.`;
}
