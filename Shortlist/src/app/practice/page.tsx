import { getPracticeBasePriceRupees } from "@/lib/pricing";
import { PracticePageClient } from "./practice-page-client";

export default function PracticePage() {
  const basePriceRupees = getPracticeBasePriceRupees();
  return <PracticePageClient basePriceRupees={basePriceRupees} />;
}
