/** Context passed to the ASR model to improve domain vocabulary recognition. */
export type TranscriptionContext = {
  domain?: string;
  topic?: string;
  positionTitle?: string | null;
  keySkills?: string[];
  jobDescription?: string | null;
  /** Mandatory and optional interview questions — mined for technical vocabulary hints. */
  interviewQuestions?: string[];
};

export type TechnicalTermCorrection = {
  pattern: RegExp;
  replacement: string;
};

export type TranscriptLogProb = {
  logprob: number;
};

export type ProcessedCandidateTranscript = {
  text: string;
  confidence: number | null;
  rejectedAsNoise: boolean;
};

/** ASR model used for candidate speech-to-text in Realtime sessions. */
export const REALTIME_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

/** Minimum average token probability below which short utterances are treated as noise. */
export const LOW_CONFIDENCE_NOISE_THRESHOLD = 0.35;

const KEYBOARD_NOISE_PATTERNS = [
  /^(click|clack|tap|tick|tock|thud|bang|clunk|type|typing|keyboard)\b/i,
  /^\[?(typing|keyboard|clicking|mic(?:rophone)?\s*noise)\]?$/i,
  /^(uh+|um+|mm+|hmm+|ah+|oh+|er+|hm+)[.!?,]*$/i,
  /^\[?(breathing|sighing|inhale|exhale)\]?$/i,
  /^(whoosh|huff|puff)\b/i,
];

/**
 * Phrases ASR models commonly hallucinate on silence, mic noise, or near-empty audio.
 * These are not plausible interview answers and must never appear in the transcript.
 */
const ASR_HALLUCINATION_PATTERNS = [
  /^(bye[\s-]?bye|goodbye|see you|see ya)\b/i,
  /^(hooray|hurray|yay|woo|woohoo|yahoo)\b/i,
  /^(thank you for watching|thanks for watching|please subscribe|like and subscribe)\b/i,
  /^(thanks for listening|thank you for listening)\b/i,
  /^(subtitle|subtitles|caption|captions)\b/i,
  /^(music|applause|\[music\]|\[applause\])\b/i,
  /\b(amara\.org|www\.|\.com\b|http)/i,
  /^(you|the end|fin)\b[.!]*$/i,
];

/** Short answers that are valid in an interview and must not be filtered as hallucinations. */
const SHORT_VALID_INTERVIEW_RESPONSES = new Set([
  "yes",
  "no",
  "sure",
  "okay",
  "ok",
  "maybe",
  "hello",
  "hi",
  "thanks",
  "thank you",
  "correct",
  "right",
  "absolutely",
  "definitely",
  "certainly",
  "understood",
]);

const TECHNICAL_INTERVIEW_SIGNAL =
  /engineer|developer|software|backend|frontend|devops|technical|programming|code|api|database|cloud|automation|node|python|java|kubernetes|docker|server|http/i;

/**
 * Known ASR mishearings for technical vocabulary (BUG-002).
 * Applied to all candidate transcripts — false-positive risk is very low in interview context.
 */
const GLOBAL_TECHNICAL_TERM_CORRECTIONS: TechnicalTermCorrection[] = [
  // "ERROR 404" / "404" often heard as "LL404"
  { pattern: /\b(?:error\s+)?LL\s*404\b/gi, replacement: "404" },
  // N8N (automation tool) often heard as "NA10" / "N A 10"
  { pattern: /\bNA\s*10\b/gi, replacement: "N8N" },
  { pattern: /\bN\s+A\s+10\b/gi, replacement: "N8N" },
];

/** Phonetic spelling hints for terms that ASR commonly confuses. */
const PHONETIC_TERM_HINTS: Record<string, string> = {
  N8N: "N8N (letter N, digit 8, letter N — not NA10)",
  "404": "HTTP 404 (four-zero-four, not LL404)",
  "500": "HTTP 500 (five-zero-zero)",
};

function isTechnicalInterview(ctx: TranscriptionContext): boolean {
  const signals = [
    ctx.domain,
    ctx.topic,
    ctx.positionTitle,
    ctx.jobDescription,
    ...(ctx.keySkills ?? []),
    ...(ctx.interviewQuestions ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  return TECHNICAL_INTERVIEW_SIGNAL.test(signals);
}

/** Extract acronyms, mixed alphanumeric tokens, and dotted tech names from source text. */
export function extractTechnicalTermsFromTexts(texts: string[]): string[] {
  const terms = new Set<string>();

  for (const raw of texts) {
    if (!raw?.trim()) continue;
    const text = raw.trim();

    for (const match of text.matchAll(/\b[A-Za-z]*\d+[A-Za-z0-9]*\b/g)) {
      if (match[0].length >= 2) terms.add(match[0]);
    }
    for (const match of text.matchAll(/\b[A-Z]{2,}(?:\/[A-Z]+)?\b/g)) {
      terms.add(match[0]);
    }
    for (const match of text.matchAll(/\b[A-Za-z]+\.[A-Za-z]+\b/g)) {
      terms.add(match[0]);
    }
    for (const match of text.matchAll(/\b[A-Z]#\b/g)) {
      terms.add(match[0]);
    }
  }

  return [...terms].sort((a, b) => b.length - a.length || a.localeCompare(b));
}

/** Collect technical terms from session context for ASR hints and post-correction. */
export function extractTechnicalTermsFromContext(ctx: TranscriptionContext): string[] {
  const sources = [
    ...(ctx.keySkills ?? []),
    ...(ctx.interviewQuestions ?? []),
    ctx.jobDescription ?? "",
    ctx.positionTitle ?? "",
    ctx.domain ?? "",
    ctx.topic ?? "",
  ];
  return extractTechnicalTermsFromTexts(sources);
}

/** Build regex corrections for session-specific terms plus global technical fixes. */
export function buildTechnicalTermCorrections(ctx: TranscriptionContext): TechnicalTermCorrection[] {
  const corrections: TechnicalTermCorrection[] = [...GLOBAL_TECHNICAL_TERM_CORRECTIONS];
  const terms = extractTechnicalTermsFromContext(ctx);

  for (const term of terms) {
    if (/^N8N$/i.test(term)) continue;
    if (/^\d{3}$/.test(term)) continue;

    const spaced = term
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/([A-Za-z])(\d)/g, "$1 $2")
      .replace(/(\d)([A-Za-z])/g, "$1 $2");
    if (spaced !== term && spaced.length >= 3) {
      const pattern = new RegExp(`\\b${spaced.replace(/\s+/g, "\\s+")}\\b`, "gi");
      corrections.push({ pattern, replacement: term });
    }
  }

  return corrections;
}

/** Fix known ASR mishearings for technical vocabulary before storing the transcript. */
export function correctTechnicalTerms(
  text: string,
  corrections: TechnicalTermCorrection[] = GLOBAL_TECHNICAL_TERM_CORRECTIONS,
): string {
  let result = text;
  for (const { pattern, replacement } of corrections) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Build a transcription prompt that steers the ASR model toward interview vocabulary,
 * English accents, and punctuation — while de-emphasizing keyboard/mic noise.
 */
export function buildTranscriptionPrompt(ctx: TranscriptionContext): string {
  const roleLabel = ctx.positionTitle?.trim() || ctx.domain?.trim();
  const parts: string[] = [
    "Spoken English job interview. Transcribe candidate answers in English with proper punctuation and capitalization.",
    "Expect Indian, British, American, and other English accents.",
    roleLabel
      ? `Expect ${roleLabel}-related professional interview vocabulary.`
      : "Expect professional interview vocabulary for the stated role.",
    "Ignore keyboard typing, mouse clicks, chair creaks, and background microphone noise.",
    "If no clear speech is present, output nothing — never guess or invent words on silence.",
  ];

  if (ctx.positionTitle?.trim()) {
    parts.push(`Role: ${ctx.positionTitle.trim()}.`);
  }
  if (ctx.domain?.trim()) {
    parts.push(`Domain: ${ctx.domain.trim()}.`);
  }
  if (ctx.topic?.trim()) {
    parts.push(`Topic: ${ctx.topic.trim()}.`);
  }

  const skills = (ctx.keySkills ?? []).map((s) => s.trim()).filter(Boolean);
  if (skills.length > 0) {
    parts.push(`Key skills and technologies: ${skills.slice(0, 20).join(", ")}.`);
  }

  const jd = ctx.jobDescription?.trim();
  if (jd) {
    parts.push(`Job description excerpt: ${jd.replace(/\s+/g, " ").slice(0, 280)}`);
  }

  const technicalTerms = extractTechnicalTermsFromContext(ctx);
  if (technicalTerms.length > 0) {
    parts.push(`Spell these technical terms exactly when heard: ${technicalTerms.slice(0, 25).join(", ")}.`);
  }

  if (isTechnicalInterview(ctx)) {
    const hints = new Set<string>();
    if (technicalTerms.some((t) => /^N8N$/i.test(t)) || /automation/i.test(skills.join(" "))) {
      hints.add(PHONETIC_TERM_HINTS.N8N);
    }
    if (
      technicalTerms.some((t) => /^(404|500|502|503)$/.test(t)) ||
      /server|http|api|error/i.test([jd, ...(ctx.interviewQuestions ?? [])].join(" "))
    ) {
      hints.add(PHONETIC_TERM_HINTS["404"]);
    }
    for (const term of technicalTerms) {
      const hint = PHONETIC_TERM_HINTS[term.toUpperCase()];
      if (hint) hints.add(hint);
    }
    if (hints.size > 0) {
      parts.push([...hints].join(" "));
    }
  }

  return parts.join(" ").slice(0, 800);
}

/** Convert ASR logprobs into a 0–1 confidence score (higher = more certain). */
export function confidenceFromLogprobs(logprobs: TranscriptLogProb[] | undefined): number | null {
  if (!logprobs?.length) return null;
  const probs = logprobs.map((entry) => Math.exp(entry.logprob));
  const avg = probs.reduce((sum, p) => sum + p, 0) / probs.length;
  return Math.round(Math.min(1, Math.max(0, avg)) * 1000) / 1000;
}

/**
 * Detect repeated-phrase hallucinations such as "Hooray! Hooray! Hooray! Hooray!"
 * that ASR models emit on near-silent audio.
 */
export function isRepeatedPhraseHallucination(text: string): boolean {
  const phrases = text
    .split(/[!?.]+/)
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);
  if (phrases.length < 3) return false;

  const first = phrases[0];
  if (first.length < 2) return false;
  return phrases.every((phrase) => phrase === first);
}

/** Detect ASR hallucinations — fabricated phrases on silence or noise. */
export function isLikelyHallucinatedTranscript(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const normalized = trimmed.replace(/[.!?,]+$/g, "").trim().toLowerCase();
  if (SHORT_VALID_INTERVIEW_RESPONSES.has(normalized)) {
    return false;
  }

  if (ASR_HALLUCINATION_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }

  if (isRepeatedPhraseHallucination(trimmed)) {
    return true;
  }

  return false;
}

/** Detect transcripts that are likely keyboard clicks, mic bumps, or background noise. */
export function isLikelyNoiseTranscript(text: string, confidence: number | null): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  if (isLikelyHallucinatedTranscript(trimmed)) {
    return true;
  }

  if (KEYBOARD_NOISE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }

  // Very short, low-confidence bursts are usually ambient noise rather than speech.
  if (confidence !== null && confidence < LOW_CONFIDENCE_NOISE_THRESHOLD && trimmed.length < 8) {
    return true;
  }

  // Repeated single character (mic tap / cable bump).
  const compact = trimmed.replace(/\s/g, "");
  if (compact.length >= 4 && /^(.)\1+$/.test(compact)) {
    return true;
  }

  return false;
}

/** Light punctuation normalization for ASR output (model usually handles most of this). */
export function normalizeTranscriptPunctuation(text: string): string {
  let result = text.replace(/\s+/g, " ").trim();
  if (!result) return result;

  // Capitalize the first letter of the utterance.
  result = result.charAt(0).toUpperCase() + result.slice(1);

  // Add terminal punctuation for longer answers that lack it.
  if (result.length > 20 && !/[.!?]$/.test(result)) {
    result += ".";
  }

  return result;
}

/**
 * Post-process a finalized candidate transcript: filter noise, normalize punctuation,
 * and attach a confidence score. Returns rejectedAsNoise=true when the utterance
 * should be treated as empty (keyboard/mic noise).
 */
export function processCandidateTranscript(
  raw: string,
  logprobs?: TranscriptLogProb[],
  options?: { transcriptionContext?: TranscriptionContext },
): ProcessedCandidateTranscript {
  const confidence = confidenceFromLogprobs(logprobs);
  const trimmed = raw.trim();

  if (isLikelyNoiseTranscript(trimmed, confidence)) {
    return { text: "", confidence, rejectedAsNoise: true };
  }

  const corrections = options?.transcriptionContext
    ? buildTechnicalTermCorrections(options.transcriptionContext)
    : GLOBAL_TECHNICAL_TERM_CORRECTIONS;
  const corrected = correctTechnicalTerms(trimmed, corrections);

  return {
    text: normalizeTranscriptPunctuation(corrected),
    confidence,
    rejectedAsNoise: false,
  };
}
