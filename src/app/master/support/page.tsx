import { Suspense } from "react";
import { MasterSupportPageClient } from "@/components/master-support-page";

export default function SupportPage() {
  return (
    <Suspense fallback={null}>
      <MasterSupportPageClient />
    </Suspense>
  );
}
