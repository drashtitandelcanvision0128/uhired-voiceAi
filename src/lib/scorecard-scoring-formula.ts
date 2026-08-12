/** How holistic overall score relates to dimension scores (see scoring.ts rubric). */
export const HOLISTIC_OVERALL_FORMULA =
  "Overall = round(35% × Communication + 40% × Domain depth + 25% × Confidence)";

export const OVERALL_WITH_ANSWER_GRADING_NOTE =
  "When per-question grading runs, overall blends 80% answer accuracy with 20% of the holistic score above.";

export function holisticOverallFromDimensions(communication: number, domainDepth: number, confidence: number) {
  return Math.round(communication * 0.35 + domainDepth * 0.4 + confidence * 0.25);
}
