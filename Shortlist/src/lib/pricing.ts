import { env } from "@/lib/env";
import {
  calculatePracticeTotalRupees,
  DEFAULT_PRACTICE_BASE_PRICE_RUPEES,
} from "@/lib/practice-pricing-shared";

export function getPracticeBasePriceRupees() {
  return Number.isFinite(env.practiceBasePriceRupees) && env.practiceBasePriceRupees > 0
    ? env.practiceBasePriceRupees
    : DEFAULT_PRACTICE_BASE_PRICE_RUPEES;
}

export function getPracticeAmountPaise(durationMin: number) {
  const basePriceRupees = getPracticeBasePriceRupees();
  return calculatePracticeTotalRupees(durationMin, basePriceRupees) * 100;
}

export function formatInrFromPaise(amountPaise: number) {
  return `₹${(amountPaise / 100).toFixed(0)}`;
}
