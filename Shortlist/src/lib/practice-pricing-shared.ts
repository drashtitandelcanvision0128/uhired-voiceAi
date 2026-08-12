export const PRACTICE_SLOT_DURATION_MIN = 10;
export const DEFAULT_PRACTICE_BASE_PRICE_RUPEES = 50;

export function calculatePracticeTotalRupees(
  durationMin: number,
  basePriceRupees = DEFAULT_PRACTICE_BASE_PRICE_RUPEES,
) {
  const slots = Math.max(1, Math.ceil(durationMin / PRACTICE_SLOT_DURATION_MIN));
  return slots * basePriceRupees;
}

export function formatPracticeRupees(amountRupees: number) {
  return `₹${amountRupees.toLocaleString("en-IN")}`;
}
