const FILLER_WORDS = new Set([
  "um",
  "uh",
  "uhh",
  "umm",
  "er",
  "ah",
  "like",
  "basically",
  "actually",
  "literally",
  "honestly",
  "right",
  "okay",
  "ok",
  "so",
  "well",
  "you know",
  "i mean",
  "kind of",
  "sort of",
  "you see",
  "let me see",
  "let's see",
]);

const FILLER_PHRASES = [
  "you know",
  "i mean",
  "kind of",
  "sort of",
  "you see",
  "let me see",
  "let's see",
];

export type PreprocessedAnswer = {
  original: string;
  cleaned: string;
  removedFillerCount: number;
};

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stripFillerPhrases(text: string): { text: string; removed: number } {
  let result = ` ${text.toLowerCase()} `;
  let removed = 0;

  for (const phrase of FILLER_PHRASES) {
    const pattern = new RegExp(`\\b${phrase.replace(/\s+/g, "\\s+")}\\b`, "gi");
    const matches = result.match(pattern);
    if (matches) removed += matches.length;
    result = result.replace(pattern, " ");
  }

  return { text: collapseWhitespace(result), removed };
}

function stripFillerWords(text: string): { text: string; removed: number } {
  const tokens = text.split(/\s+/).filter(Boolean);
  let removed = 0;
  const kept: string[] = [];

  for (const token of tokens) {
    const normalized = token.toLowerCase().replace(/[^a-z0-9'-]/g, "");
    if (FILLER_WORDS.has(normalized)) {
      removed += 1;
      continue;
    }
    kept.push(token);
  }

  return { text: kept.join(" "), removed };
}

/**
 * Normalize spoken interview answers for semantic comparison.
 * Removes filler words/phrases and collapses whitespace without altering meaning.
 */
export function preprocessSpokenAnswer(raw: string): PreprocessedAnswer {
  const original = raw.trim();
  if (!original) {
    return { original, cleaned: "", removedFillerCount: 0 };
  }

  const phrasePass = stripFillerPhrases(original);
  const wordPass = stripFillerWords(phrasePass.text);
  const cleaned = collapseWhitespace(wordPass.text);

  return {
    original,
    cleaned,
    removedFillerCount: phrasePass.removed + wordPass.removed,
  };
}

/**
 * Split ideal/reference answers into gradeable concept units.
 */
export function extractConceptsFromIdealAnswer(idealAnswer: string, maxConcepts = 8): string[] {
  const normalized = idealAnswer
    .replace(/\r\n/g, "\n")
    .replace(/[•●▪◦]/g, "\n")
    .trim();

  const chunks = normalized
    .split(/\n|;|(?:\.\s+)/)
    .map((part) => part.replace(/^[-*]\s*/, "").trim())
    .filter((part) => part.length >= 12);

  const unique: string[] = [];
  const seen = new Set<string>();

  for (const chunk of chunks) {
    const key = chunk.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(chunk);
    if (unique.length >= maxConcepts) break;
  }

  if (unique.length === 0 && normalized.length >= 12) {
    return [normalized.slice(0, 500)];
  }

  return unique;
}
