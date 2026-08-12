import type { Metadata } from "next";
import { ScorecardShareInvalid } from "@/components/scorecard-share-invalid";
import { ScorecardSharePublicView } from "@/components/scorecard-share-public";
import { buildScorecardSharePublicPayload } from "@/lib/scorecard-share-payload";
import { findActiveScorecardShareByRawToken } from "@/lib/scorecard-share-resolve";

export const metadata: Metadata = {
  title: "Interview scorecard",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function ShareScorecardPage({ params }: PageProps) {
  const { token } = await params;
  const decoded = decodeURIComponent(token);
  const link = await findActiveScorecardShareByRawToken(decoded);
  if (!link) {
    return <ScorecardShareInvalid />;
  }

  const payload = buildScorecardSharePublicPayload(link, link.session);

  return (
    <main className="min-h-screen bg-slate-50">
      <ScorecardSharePublicView payload={payload} />
    </main>
  );
}
