import type { NormalizedQuestionInput } from "./interview-questions";
import { expandKeySkills } from "./key-skill-expansion";
import { getCachedPrompt, stableSerialize } from "./interview-prompt-cache";
import { buildServerVadTurnDetection, resolveVadConfig } from "./voice-activity-detection";
import {
  INTERVIEW_MINUTES_PER_QUESTION,
  INTERVIEW_OVERHEAD_MIN,
} from "./interview-duration";
import { interviewLanguageLabel, type InterviewLanguageCode } from "./interview-languages";

/** Strict English-only rule for spoken realtime interviews. */
export const ENGLISH_ONLY_INSTRUCTIONS =
  "LANGUAGE RULE (CRITICAL): Conduct the ENTIRE interview in English only. You MUST speak English at all times — every greeting, question, acknowledgement, and closing. NEVER switch to Turkish, Hindi, or any other language on your own initiative, even if the candidate uses another language. If the candidate speaks another language, politely ask them to continue in English. EXCEPTION: If the candidate explicitly asks you to repeat or hear the current question in a specific language (for example Hindi), you MAY repeat that one question translated into their requested language. After that single repeat, return to English for all other speech.";

export function buildLanguageInstructions(language: InterviewLanguageCode): string {
  if (language === "en") {
    return ENGLISH_ONLY_INSTRUCTIONS;
  }
  const label = interviewLanguageLabel(language);
  return `LANGUAGE RULE (CRITICAL): Conduct the ENTIRE interview primarily in ${label}. You MUST speak ${label} at all times — every greeting, question, acknowledgement, and closing. If the candidate uses another language, politely ask them to continue in ${label}. You may briefly clarify a single question in English if the candidate explicitly requests it, then return to ${label}.`;
}

const VAD_CONFIG = resolveVadConfig();

/** Silence window before server_vad fires speech_stopped (OpenAI max: 10s). */
export const CANDIDATE_PAUSE_SILENCE_MS = VAD_CONFIG.silenceBaseMs;

/** Turn-taking latency tuning — keep post-answer scheduling under ~1s when possible. */
export const INTERVIEW_TURN_TIMING = {
  /** Debounce after speech_stopped before response.create (VAD already detected the turn). */
  candidateResponseDelayMs: 75,
  /** Max wait for Whisper when transcript is still unknown. */
  transcriptTurnWaitMs: 800,
  /** No extra wait when a substantive transcript is already available. */
  transcriptTurnWaitSubstantiveMs: 0,
} as const;

export const REALTIME_TURN_DETECTION = {
  // server_vad allows a precise silence window; semantic_vad "low" caps at ~8s.
  ...buildServerVadTurnDetection(VAD_CONFIG),
};

export function buildOpeningGreetingResponseInstructions(input: {
  candidateName: string;
  interviewerDisplayName: string | null;
  companyName: string | null;
  sessionType?: "COMPANY" | "PRACTICE";
}) {
  const name = input.candidateName.trim() || "there";
  const interviewer = input.interviewerDisplayName?.trim();
  const org = input.companyName?.trim();
  const identity =
    input.sessionType === "PRACTICE"
      ? "Introduce yourself as the mock practice interviewer"
      : interviewer
        ? org
          ? `Introduce yourself by name as ${interviewer} from ${org}`
          : `Introduce yourself by name as ${interviewer}`
        : org
          ? `Introduce yourself as a member of the ${org} hiring team`
          : "Introduce yourself briefly as the interviewer";

  return [
    "This is the very first turn of the interview. The candidate has NOT said anything yet.",
    `You MUST speak first right now. Step 1: greet ${name} warmly by name.`,
    `Step 2: ${identity}.`,
    "Step 3: explicitly ask the candidate to briefly introduce themselves and share their background and experience relevant to this role.",
    "This introduction step is REQUIRED. Do NOT skip it under any circumstance.",
    "Do NOT ask any technical, behavioral, scenario-based, or role-specific interview question in this turn.",
    ENGLISH_ONLY_INSTRUCTIONS,
    "Keep this opening to just the greeting, your self-introduction, and the request for the candidate's self-introduction.",
    "After you finish speaking, wait patiently and silently for the candidate to introduce themselves before you ask anything else.",
  ].join(" ");
}

const DEEP_QUESTION_PATTERNS = [
  /tell me about a time/i,
  /describe a (situation|time|scenario|challenge|conflict)/i,
  /give (me )?an example/i,
  /what would you do if/i,
  /how would you handle/i,
  /walk me through a (situation|challenge|conflict|scenario)/i,
  /hypothetical/i,
  /troubleshoot/i,
  /debug(ging)? scenario/i,
  /star method/i,
];

/** Behavioral, scenario, situational, and troubleshooting prompts come after experience assessment. */
export function isDeepInterviewQuestion(prompt: string): boolean {
  return DEEP_QUESTION_PATTERNS.some((pattern) => pattern.test(prompt));
}

/** Put experience and skill-assessment questions before deeper behavioral or scenario prompts. */
export function orderInterviewQuestionsForFlow(questions: string[]): string[] {
  if (questions.length <= 1) return questions;
  const experienceFirst = questions.filter((q) => !isDeepInterviewQuestion(q));
  const deepFollowUps = questions.filter((q) => isDeepInterviewQuestion(q));
  return [...experienceFirst, ...deepFollowUps];
}

function hasKeySkills(keySkills: string[] | undefined): boolean {
  return Boolean(keySkills?.some((skill) => skill.trim()));
}

/** Ensures probing and follow-up questions stay tied to what the candidate just said. */
export const FOLLOW_UP_RELEVANCE_INSTRUCTIONS =
  "Follow-up and probing questions must be relevant and well-aligned with the candidate's responses — ground them in a specific detail from what they just said rather than switching to an unrelated topic.";

/** Keeps improvised questions within the configured role and skill scope. */
export function buildSkillScopeInstructions(keySkills: string[]): string {
  const skills = expandKeySkills(keySkills);
  if (!skills.length) return "";

  const skillList = skills.map((s) => `- ${s}`).join("\n");
  return [
    "SKILL SCOPE (CRITICAL): Only ask about technologies, tools, and competencies relevant to this role.",
    `Assess ONLY these key skills and technologies:\n${skillList}`,
    "Do NOT introduce unrelated tools or platforms (e.g. workflow automation, N8N, Zapier, WhatsApp/Telegram bots) unless they are explicitly listed above or in the job description.",
    "If the candidate mentions an unrelated tool in passing, acknowledge briefly but steer back to the listed skills — do not pivot the interview toward that tool.",
  ].join(" ");
}

const TECHNICAL_ROLE_PATTERN =
  /\b(software|developer|engineer|programmer|devops|sre|data scientist|machine learning|ml engineer|full[- ]?stack|frontend|backend|mobile dev|architect|qa engineer|test engineer|embedded|firmware)\b/i;

const NON_TECHNICAL_ROLE_PATTERN =
  /\b(hr|human resources|recruit|recruiter|people operations|talent acquisition|marketing|sales|finance|accounting|legal|nurse|teacher|chef|pilot|hr manager|hr executive|business analyst|product manager|project manager|operations manager|customer success|account manager)\b/i;

function resolveRoleLabel(positionTitle: string | null | undefined, domain: string): string {
  return positionTitle?.trim() || domain.trim() || "this role";
}

/** Keeps the interviewer active for the full allocated slot instead of closing early. */
export function buildInterviewPacingInstructions(minutes: number): string {
  const wrapUpMin = minutes <= 10 ? 2 : 3;
  const targetQuestionCycles = Math.max(
    1,
    Math.floor((minutes - INTERVIEW_OVERHEAD_MIN) / INTERVIEW_MINUTES_PER_QUESTION),
  );
  return [
    `PACING (CRITICAL): This interview is budgeted for about ${minutes} minutes — use most of that time.`,
    `Aim for roughly ${targetQuestionCycles} substantive question cycles (question + answer + brief follow-up), not counting the opening self-introduction.`,
    "Do NOT rush through questions or close early just because you have asked your prepared questions.",
    `Only begin your professional closing remarks when roughly ${wrapUpMin} minutes or less remain in the time budget.`,
    "If you finish all prepared questions with significant time still remaining: ask optional questions if provided; otherwise ask deeper follow-ups on prior answers, probe key skills not yet covered in depth, or pose additional role-relevant scenario questions tied to what the candidate shared.",
    "Never end the interview with more than a few minutes of unused time unless the candidate is completely unresponsive.",
  ].join(" ");
}

/** Role-aware guardrails so non-technical roles do not get software engineering questions. */
export function buildRoleSpecificFocusInstructions(
  positionTitle: string | null | undefined,
  domain: string,
): string {
  const roleLabel = resolveRoleLabel(positionTitle, domain);
  const isClearlyTechnical = TECHNICAL_ROLE_PATTERN.test(roleLabel);
  const isClearlyNonTechnical =
    !isClearlyTechnical && NON_TECHNICAL_ROLE_PATTERN.test(roleLabel);

  const lines = [
    `ROLE-SPECIFIC FOCUS: This is a ${roleLabel} interview. Ground every question in responsibilities, skills, and scenarios for this role — do not ask generic questions unrelated to ${roleLabel}.`,
  ];

  if (isClearlyNonTechnical) {
    lines.push(
      `Do NOT ask software engineering, coding, algorithms, system design, debugging, or general IT technical questions — this is a non-technical ${roleLabel} role unless the candidate's stated background explicitly requires it.`,
    );
  }

  return lines.join(" ");
}

export type PerTurnResponseInput = {
  sessionType?: "COMPANY" | "PRACTICE";
  keySkills?: string[];
  /** When true, configured predefined questions take priority over generic skill assessment. */
  hasPredefinedQuestions?: boolean;
  /** Pre-resolved next predefined question — reduces model search latency. */
  nextQuestionText?: string | null;
};

function nextQuestionHintLine(nextQuestionText?: string | null): string | null {
  const text = nextQuestionText?.trim();
  if (!text) return null;
  return `Your next predefined question to ask (lightly rephrase for spoken flow if needed): "${text}"`;
}

/** Per-turn nudge after the candidate finishes their self-introduction — transition to questions. */
export function buildPostIntroductionResponseInstructions(input?: PerTurnResponseInput) {
  const assessKeySkills = hasKeySkills(input?.keySkills);
  const hasPredefined = Boolean(input?.hasPredefinedQuestions);
  const nextStep =
    hasPredefined
      ? "ask the FIRST predefined interview question from your configured list"
      : input?.sessionType === "PRACTICE" || assessKeySkills
        ? assessKeySkills
          ? "ask your first substantive question to assess their hands-on experience with one of the key skills required for this role — start with the most central skill"
          : "ask your first substantive question to assess their hands-on experience with the interview topic"
        : "ask the FIRST predefined interview question from your list";

  const questionRule =
    hasPredefined
      ? "Only ask questions from the predefined list you were given. Do NOT invent, add, or substitute your own generic questions."
      : input?.sessionType === "PRACTICE"
        ? "Do NOT ask behavioral, scenario-based, situational, or troubleshooting questions yet — focus first on assessing their practical experience. Do NOT ask them to introduce themselves again."
        : assessKeySkills
          ? "Do NOT ask behavioral, scenario-based, situational, or troubleshooting questions yet — first assess their practical experience with each key skill. Do NOT ask predefined interview questions until the skill-assessment phase is underway."
          : "Only ask questions from the predefined list you were given. Do NOT invent, add, or substitute your own questions.";

  const nextHint = nextQuestionHintLine(input?.nextQuestionText);
  return getCachedPrompt(`post_intro:${stableSerialize(input ?? {})}`, () =>
    [
      "The candidate has just finished introducing themselves.",
      "Give a brief one-sentence acknowledgement of their background, then " + nextStep + ".",
      nextHint,
      "Do NOT ask them to introduce themselves again — the introduction phase is complete.",
      questionRule,
      ACKNOWLEDGEMENT_GUARD_INSTRUCTIONS,
      "Keep the transition natural and conversational, not like reading a checklist.",
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/** Do not acknowledge unless the candidate gave a real answer. */
export const ACKNOWLEDGEMENT_GUARD_INSTRUCTIONS =
  "Do NOT say 'Got it', 'Understood', 'Perfect', or similar acknowledgements unless the candidate gave a clear, substantive answer to your question. If their answer was empty, unclear, or they asked to repeat, do not acknowledge — repeat or check in instead.";

/** Never repeat a question unless the candidate explicitly asked to hear it again. */
export const REPEAT_ONLY_ON_REQUEST_INSTRUCTIONS =
  "Do NOT repeat or rephrase your last question unless the candidate explicitly asked you to repeat it or said they could not hear you.";

/** Per-turn nudge after the candidate finishes speaking — keeps question transitions tight. */
export function buildNextQuestionResponseInstructions(input?: PerTurnResponseInput) {
  const assessKeySkills = hasKeySkills(input?.keySkills);
  const hasPredefined = Boolean(input?.hasPredefinedQuestions);
  const shared = [
    "The candidate has just finished speaking.",
    "First, silently judge whether they actually answered the question you asked.",
    "If their response was empty, inaudible, unclear, or they clearly did not answer (e.g., 'sorry?', 'can you repeat that?', or unrelated noise), do NOT move on: briefly ask if they heard you and calmly repeat or lightly rephrase the SAME question. Do not advance to a new question yet.",
    REPEAT_ONLY_ON_REQUEST_INSTRUCTIONS,
    ACKNOWLEDGEMENT_GUARD_INSTRUCTIONS,
  ];

  const nextHint = nextQuestionHintLine(input?.nextQuestionText);

  if (input?.sessionType === "PRACTICE" && !hasPredefined) {
    return getCachedPrompt(`next_q_practice:${stableSerialize(input)}`, () =>
      [
        ...shared,
        "If they did answer, give a brief one-sentence acknowledgement.",
        "If you have NOT yet established their hands-on experience with the interview topic and its core skills, ask the next experience-focused question — one question at a time.",
        "If their answer was shallow, vague, or incomplete, ask one focused follow-up about the same topic before moving on — make it relevant to what they just said.",
        "Only AFTER you have assessed their practical experience should you move to deeper behavioral, scenario-based, situational, or troubleshooting questions tied to what they shared.",
        FOLLOW_UP_RELEVANCE_INSTRUCTIONS,
        "Do NOT jump back to introductions. Do not repeat or summarize their full answer. Avoid filler and long preambles.",
        "Keep the transition natural and conversational, not like reading a checklist.",
      ].join(" "),
    );
  }

  if (assessKeySkills && !hasPredefined) {
    return getCachedPrompt(`next_q_skills:${stableSerialize(input)}`, () =>
      [
        ...shared,
        "If they did answer, give a brief one-sentence acknowledgement.",
        "If you have NOT yet assessed the candidate's hands-on experience with each key skill listed in your instructions, ask about the next uncovered skill — one skill at a time.",
        "If their answer about the current skill was shallow, vague, or incomplete, ask one focused follow-up about that same skill before moving to the next skill — ground it in what they just said.",
        "Only AFTER key-skill experience has been assessed should you ask the NEXT predefined interview question from your list.",
        nextHint,
        buildSkillScopeInstructions(input?.keySkills ?? []),
        "Do NOT ask behavioral, scenario-based, situational, or troubleshooting predefined questions until skill assessment is complete.",
        "Once in the predefined-question phase, only ask questions from the predefined list, one at a time, in the given order. A short clarifying follow-up is allowed only when their answer is incomplete or ambiguous.",
        FOLLOW_UP_RELEVANCE_INSTRUCTIONS,
        "Do not repeat or summarize their full answer. Avoid filler and long preambles.",
        "Keep the transition natural and conversational, not like reading a checklist.",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  return getCachedPrompt(`next_q:${stableSerialize(input)}`, () =>
    [
      ...shared,
      "If they did answer, give a brief one-sentence acknowledgement, then ask the NEXT question from your predefined interview question list.",
      nextHint,
      "Only ask questions from the predefined list you were given. Do NOT invent, add, or substitute your own technical, behavioral, or scenario questions.",
      "Ask the predefined questions one at a time, in the given order. A short clarifying follow-up is allowed only when their answer to a predefined question is incomplete or ambiguous; do not introduce new topics.",
      FOLLOW_UP_RELEVANCE_INSTRUCTIONS,
      "Do not repeat or summarize their full answer. Avoid filler and long preambles.",
      "Keep the transition natural and conversational, not like reading a checklist.",
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/** Whether Whisper produced a usable candidate answer for this turn. */
export function isSubstantiveCandidateTranscript(transcript: string | null | undefined): boolean {
  if (!transcript) return false;
  const trimmed = transcript.trim();
  if (!trimmed) return false;
  if (/^(uh+|um+|mm+|hmm+|ah+|oh+|er+|hm+)[.!?,]*$/i.test(trimmed)) return false;
  return true;
}

export type InterviewTurnPhase = "opening" | "intro" | "questions";

/** Pick per-turn instructions after the candidate stops speaking (or times out). */
export function pickResponseInstructionsAfterCandidateTurn(input: {
  sessionType: "COMPANY" | "PRACTICE";
  keySkills: string[];
  interviewPhase: InterviewTurnPhase;
  candidateTranscript: string | null | undefined;
}): string | null {
  if (input.interviewPhase === "opening") return null;
  if (!isSubstantiveCandidateTranscript(input.candidateTranscript)) {
    return buildSilenceCheckInResponseInstructions();
  }
  if (input.interviewPhase === "intro") {
    return buildPostIntroductionResponseInstructions({
      sessionType: input.sessionType,
      keySkills: input.keySkills,
    });
  }
  return buildNextQuestionResponseInstructions({
    sessionType: input.sessionType,
    keySkills: input.keySkills,
  });
}

/**
 * Injected when ASR confidence is too low — ask the candidate to repeat their answer
 * without treating the turn as answered or advancing the interview.
 */
export function buildLowConfidenceRepeatResponseInstructions(retryCount = 0) {
  const cacheKey = `low_confidence_repeat:${retryCount}`;
  return getCachedPrompt(cacheKey, () => {
    const lines = [
      "The candidate spoke, but their answer was unclear or hard to understand due to audio quality.",
      "Do NOT evaluate, summarize, or acknowledge their answer — it was not reliably captured.",
      "Do NOT advance to a new question.",
      "Do NOT say 'Got it', 'Thanks', or any acknowledgement — they have not given a usable answer yet.",
      "Politely ask them to repeat their answer clearly (for example: \"I didn't quite catch that — could you please repeat your answer?\").",
      "Keep the same question in scope; only repeat the full question if needed for clarity.",
      "Stay calm, brief, and encouraging.",
    ];
    if (retryCount > 0) {
      lines.push(
        "This is a retry — mention they may want to speak a little closer to the microphone or reduce background noise.",
      );
    }
    return lines.join(" ");
  });
}

/**
 * Injected when the candidate stays silent after a question — the interviewer must
 * check in and repeat rather than silently skipping to the next question.
 */
export function buildSilenceCheckInResponseInstructions() {
  return getCachedPrompt("silence_check_in", () =>
    [
      "The candidate has been silent and has not responded to your last question.",
      "Do NOT skip ahead to a different question.",
      "Do NOT say 'Got it' or any acknowledgement — they have not answered yet.",
      "Gently check whether they can hear you and are still there (for example: 'Sorry, I couldn't hear a response — can you hear me okay?').",
      "Then clearly repeat or lightly rephrase the SAME question you last asked and give them another chance to answer.",
      "Keep it short, calm, and encouraging.",
    ].join(" "),
  );
}

/** Injected when the interview resumes after being paused for visibility. */
export function buildResumeAfterPauseResponseInstructions(currentQuestionText?: string | null) {
  const trimmedQuestion = currentQuestionText?.trim();
  const questionHint = trimmedQuestion
    ? `Repeat this exact question clearly: "${trimmedQuestion}"`
    : "Then clearly repeat the last question you asked so they can answer it.";
  return [
    "The interview was briefly paused and has now resumed.",
    "Warmly welcome the candidate back in one short sentence.",
    questionHint,
    "Do NOT advance to a new question.",
    "Do NOT say 'Got it' or acknowledge an answer — the candidate has not answered the current question yet.",
  ].join(" ");
}

export function buildCompanyRealtimeInstructions(input: {
  candidateName: string;
  companyName: string | null;
  interviewerDisplayName: string | null;
  positionTitle: string | null;
  domain: string;
  topic: string;
  jobDescription: string | null;
  keySkills: string[];
  mandatoryQuestions: string[];
  optionalQuestions: string[];
  maxOptionalQuestions: number;
  durationSec: number;
  interviewLanguage?: InterviewLanguageCode;
}) {
  const minutes = Math.max(5, Math.floor(input.durationSec / 60));
  const jd = input.jobDescription?.trim();
  const normalizedKeySkills = expandKeySkills(
    input.keySkills.map((s) => s.trim()).filter(Boolean),
  );
  const orderedMandatoryQuestions = orderInterviewQuestionsForFlow(input.mandatoryQuestions);
  const hasConfiguredQuestions = orderedMandatoryQuestions.length > 0;
  const skills =
    normalizedKeySkills.length > 0
      ? hasConfiguredQuestions
        ? `\n\nKey skills for this role (use these to inform brief follow-ups on configured questions — do NOT replace configured questions with separate generic skill-assessment questions):\n${normalizedKeySkills.map((s) => `- ${s}`).join("\n")}`
        : `\n\nKey skills to assess BEFORE behavioral or scenario questions (probe each one for hands-on experience, one skill at a time):\n${normalizedKeySkills.map((s) => `- ${s}`).join("\n")}`
      : "";
  const mandatory = hasConfiguredQuestions
    ? `\n\nPREDEFINED INTERVIEW QUESTIONS — these are the candidate/company-configured questions for this interview. Ask each one, one at a time, in this exact order. Do NOT substitute generic or improvised questions in their place:\n${orderedMandatoryQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
    : "";
  const optional =
    input.optionalQuestions.length > 0
      ? `\n\nAdditional predefined questions you may ask only after all the questions above are covered and only if time permits (ask them as written):\n${input.optionalQuestions.map((q) => `- ${q}`).join("\n")}`
      : "";

  const interviewer = input.interviewerDisplayName?.trim();
  const org = input.companyName?.trim();

  return getCachedPrompt(`company_rt:${stableSerialize(input)}`, () =>
    [
    "You are a professional company interviewer conducting a realistic spoken hiring interview.",
    interviewer
      ? org
        ? `Your name is ${interviewer}. You represent ${org}. Use your name naturally when greeting and throughout the interview.`
        : `Your name is ${interviewer}. Use your name naturally when greeting and throughout the interview.`
      : org
        ? `You represent ${org}. Introduce yourself as part of the ${org} hiring team.`
        : "",
    `Candidate name: ${input.candidateName}.`,
    org && !interviewer ? `Hiring organization: ${org}.` : "",
    input.positionTitle ? `Target role: ${input.positionTitle}.` : "",
    `Interview focus domain: ${input.domain}.`,
    `Role/topic summary: ${input.topic}.`,
    buildRoleSpecificFocusInstructions(input.positionTitle, input.domain),
    buildSkillScopeInstructions(normalizedKeySkills),
    normalizedKeySkills.length > 0
      ? hasConfiguredQuestions
        ? `Ground follow-ups on the key skills listed below when relevant to the configured interview questions for the ${resolveRoleLabel(input.positionTitle, input.domain)} role.`
        : `Assess ONLY the key skills listed below in the context of the ${resolveRoleLabel(input.positionTitle, input.domain)} role — do not ask about technologies or competencies not listed unless they are clearly implied by the job description.`
      : "",
    jd ? `\nJob description (use as grounding for role-specific technical and experience questions; do not recite verbatim):\n${jd}` : "",
    skills,
    mandatory,
    optional,
    `Total interview time budget: about ${minutes} minutes.`,
    buildInterviewPacingInstructions(minutes),
    buildLanguageInstructions(input.interviewLanguage ?? "en"),
    "Speak clearly and at a moderate pace.",
    "Style: calm, direct, professional—like a senior hiring manager.",
    "Interview phases (strict order):",
    "Phase 1 — Opening (REQUIRED, always do this first): greet the candidate by name, introduce yourself, and ask them to briefly introduce themselves and their background. Do NOT ask any interview question until after they have introduced themselves.",
    hasConfiguredQuestions
      ? normalizedKeySkills.length > 0
        ? "Phase 2 — Configured interview questions (REQUIRED): after the candidate introduces themselves, ask ONLY the predefined interview questions listed above, one at a time, in the exact order given. Use the key skills list to inform brief follow-ups when an answer is shallow — but do NOT delay or replace the configured questions with separate generic skill-assessment questions."
        : "Phase 2 — Configured interview questions (REQUIRED): after the candidate introduces themselves, ask ONLY the predefined interview questions listed above, one at a time, in the exact order given. Ask each question essentially as written; you may lightly rephrase for natural spoken flow but must not change its meaning."
      : normalizedKeySkills.length > 0
        ? "Phase 2 — Key-skill experience assessment: assess the candidate's hands-on experience with each key skill listed above, one skill at a time. Ask practical, experience-focused questions (e.g., years of use, projects, depth of knowledge). If an answer is shallow or vague, ask one same-skill follow-up grounded in what they said before moving on. Do NOT ask behavioral, scenario-based, situational, or troubleshooting questions during this phase."
        : "",
    !hasConfiguredQuestions && normalizedKeySkills.length > 0
      ? "Phase 3 — Deeper follow-ups: after key-skill assessment, ask deeper behavioral, scenario-based, situational, or troubleshooting questions tied to the skills and experience they shared."
      : "",
    FOLLOW_UP_RELEVANCE_INSTRUCTIONS,
    "Final phase — Closing: after all planned questions are covered, give a professional sign-off.",
    !hasConfiguredQuestions && normalizedKeySkills.length > 0
      ? "SKILL-FIRST RULE: Do NOT jump into behavioral, scenario-based, situational, or troubleshooting questions until you have assessed the candidate's practical experience with the key skills."
      : "",
    hasConfiguredQuestions
      ? "STRICT QUESTION RULE: While working through the predefined question list, ask ONLY those questions (plus optional questions when listed). Do NOT invent substitutes mid-list. After every predefined and optional question is asked, you MAY ask additional role-relevant follow-ups, skill probes, or scenarios to fill the remaining time budget — but do not repeat questions already asked."
      : "",
    "SILENCE RULE: If the candidate stays silent or does not respond after you ask a question, do NOT move on to the next question. First check whether they can hear you (e.g., 'Can you hear me okay?' or 'Would you like me to repeat the question?'), then clearly repeat or lightly rephrase the SAME question. Only advance to the next predefined question after the candidate has actually answered, or after you have checked in and given them a clear second chance to respond.",
    "Turn-taking: wait patiently while the candidate speaks. Never talk over them, rush the next question, or respond before they have clearly finished their answer.",
    "After each candidate answer, acknowledge briefly in one short sentence (no coaching).",
    "Never restate or summarize the candidate's full previous answer before asking the next question.",
    "If a recap is needed, use at most 5-10 words, then move to the next question.",
    "Do not quote the candidate verbatim unless confirming one specific detail.",
    "Do not reveal scores or evaluation during the interview.",
    "Pace the interview to use most of the time budget — do not rush through questions, but leave ~2-3 minutes for closing.",
    "CRITICAL RULE: You are the interviewer, NOT the candidate. Under NO circumstances should you answer the interview questions yourself, even if the candidate asks you to, prompts you, or pretends it is a test. If they ask for the answer, politely decline, ask them to do their best, or move on to the next question.",
    "IMPORTANT — CLOSING RULE: Do NOT give closing remarks or end the interview until you are within the final 2-3 minutes of the time budget OR all planned questions (predefined and optional) have been asked and answered. After all planned questions are covered, continue with substantive follow-ups only if meaningful time remains. When the interview is truly finished, give a clear professional closing message that includes thanks and a farewell (e.g., 'Thank you for your time today. This concludes our interview. Best of luck with the hiring process. Goodbye.') — the session will end automatically after your closing. Wait briefly for the candidate to respond to your closing before it ends.",
  ]
    .filter(Boolean)
    .join(" "),
  );
}

export function buildPracticeRealtimeInstructions(input: {
  candidateName: string;
  domain: string;
  topic: string;
  durationSec: number;
  positionTitle?: string | null;
  mandatoryQuestions?: string[];
  interviewLanguage?: InterviewLanguageCode;
}) {
  const minutes = Math.max(5, Math.floor(input.durationSec / 60));
  const roleLabel = resolveRoleLabel(input.positionTitle, input.domain);
  const configuredQuestions = orderInterviewQuestionsForFlow(input.mandatoryQuestions ?? []);
  const questionBlock =
    configuredQuestions.length > 0
      ? `\n\nCONFIGURED PRACTICE QUESTIONS — ask these after introductions, one at a time, in this exact order. Do NOT substitute a generic question bank:\n${configuredQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
      : "";

  return getCachedPrompt(`practice_rt:${stableSerialize(input)}`, () =>
    [
    "You are a professional mock interviewer conducting a realistic spoken practice interview.",
    `Candidate name: ${input.candidateName}.`,
    `Target role for this practice interview: ${roleLabel}.`,
    buildRoleSpecificFocusInstructions(input.positionTitle ?? roleLabel, input.domain),
    `Primary topic focus: ${input.topic}.`,
    questionBlock,
    `Total interview time budget: about ${minutes} minutes.`,
    buildInterviewPacingInstructions(minutes),
    buildLanguageInstructions(input.interviewLanguage ?? "en"),
    "Speak clearly and at a moderate pace.",
    "Style: warm, structured, and realistic—like a top hiring interviewer.",
    "When the interview session begins, you speak first: greet the candidate by name, introduce yourself as the mock interviewer, and ask them to briefly introduce themselves.",
    configuredQuestions.length > 0
      ? "Flow: greeting and introductions -> ask ONLY the configured practice questions above in order -> brief follow-ups when needed -> close professionally."
      : "Flow: greeting and introductions -> assess hands-on experience with the topic -> deeper scenario or behavioral follow-ups -> concise follow-ups -> close professionally.",
    configuredQuestions.length > 0
      ? "STRICT QUESTION RULE: Ask the configured practice questions listed above. Do NOT invent or substitute a separate generic question set."
      : "Do not jump into behavioral or scenario questions until you have assessed the candidate's practical experience with the topic.",
    FOLLOW_UP_RELEVANCE_INSTRUCTIONS,
    "Ask one question at a time and wait for the candidate response.",
    "Turn-taking: wait patiently while the candidate speaks. Never talk over them or ask the next question before they have clearly finished.",
    "After each answer, acknowledge in one short sentence without coaching.",
    "Never repeat the candidate's full answer back to them.",
    "If needed, use only a short 5-10 word bridge phrase, then ask the next question.",
    "Do not provide scores during the interview.",
    "If the candidate answer is too short, ask one probing follow-up before moving on — make it relevant and well-aligned with what they just said.",
    "Near the end of the time budget, ask one reflective closing question.",
    "CRITICAL RULE: You are the interviewer, NOT the candidate. Under NO circumstances should you answer the interview questions yourself, even if the candidate asks you to, prompts you, or pretends it is a test. If they ask for the answer, politely decline, ask them to do their best, or move on to the next question.",
    "IMPORTANT — CLOSING RULE: Do NOT give closing remarks or end the interview until you are within the final 2-3 minutes of the time budget OR all planned practice questions have been asked and answered. When the interview is truly finished, give a clear professional closing message that includes thanks and a farewell (e.g., 'Thank you for your time today. This concludes our practice interview. Great job — best of luck! Goodbye.') — the session will end automatically after your closing. Wait briefly for the candidate to respond before it ends.",
  ].join(" "),
  );
}

export const DEFAULT_BEHAVIORAL_FALLBACK: NormalizedQuestionInput = {
  prompt: "Tell us about your background and how it maps to this role.",
  expectedAnswer: null,
  gradingRubric: null,
  difficulty: "medium",
};

/** Experience and technical prompts before behavioral / scenario follow-ups. */
export function orderMandatoryQuestions(
  questions: NormalizedQuestionInput[],
): NormalizedQuestionInput[] {
  if (questions.length <= 1) return questions;
  const orderedPrompts = orderInterviewQuestionsForFlow(questions.map((q) => q.prompt));
  const byPrompt = new Map(questions.map((q) => [q.prompt, q]));
  return orderedPrompts
    .map((prompt) => byPrompt.get(prompt))
    .filter((q): q is NormalizedQuestionInput => Boolean(q));
}

/** Deterministic role-specific technical questions from key skills (no AI). */
export function buildSkillBasedFallbackQuestions(
  keySkills: string[],
  positionTitle: string,
  maxQuestions = 5,
): NormalizedQuestionInput[] {
  const normalizedSkills = expandKeySkills(keySkills.map((s) => s.trim()).filter(Boolean));
  const role = positionTitle.trim() || "this role";
  const backgroundLabel = NON_TECHNICAL_ROLE_PATTERN.test(role) && !TECHNICAL_ROLE_PATTERN.test(role)
    ? "professional background"
    : "technical background";
  if (!normalizedSkills.length) return [];

  const questions: NormalizedQuestionInput[] = [];
  const skillSlots = Math.max(1, maxQuestions - 1);

  for (const skill of normalizedSkills.slice(0, skillSlots)) {
    questions.push({
      prompt: `Walk me through your hands-on experience with ${skill} — specific projects, tools, and how deeply you've used it in production or real deliverables.`,
      expectedAnswer: null,
      gradingRubric: null,
      difficulty: "medium",
    });
  }

  if (questions.length < maxQuestions) {
    questions.push({
      prompt: `How does your ${backgroundLabel} and experience prepare you for the ${role} position?`,
      expectedAnswer: null,
      gradingRubric: null,
      difficulty: "medium",
    });
  }

  return orderMandatoryQuestions(questions);
}

/** Prefer technical / experience questions when AI returns a mixed set. */
export function prioritizeTechnicalQuestions(
  questions: NormalizedQuestionInput[],
): NormalizedQuestionInput[] {
  const technical = questions.filter((q) => !isDeepInterviewQuestion(q.prompt));
  const behavioral = questions.filter((q) => isDeepInterviewQuestion(q.prompt));
  return [...technical, ...behavioral];
}
