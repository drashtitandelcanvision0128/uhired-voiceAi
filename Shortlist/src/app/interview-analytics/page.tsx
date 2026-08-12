import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/site/marketing-page-shell";
import { PageHero } from "@/components/marketing/site/page-hero";
import { ButtonLink } from "@/components/marketing/site/shared";
import { AnalyticsSection, TranscriptionSection } from "@/components/marketing/site/SectionsIntelligence";
import { RecruiterDashboard } from "@/components/marketing/site/SectionsPlatform";
import { CTASection } from "@/components/marketing/site/SectionsTrust";

export const metadata: Metadata = {
  title: "Interview Analytics",
  description:
    "Speaking balance, response quality, completion signals, and searchable transcripts for every AI interview.",
};

export default function InterviewAnalyticsPage() {
  return (
    <MarketingPageShell>
      <PageHero
        eyebrow="Interview analytics"
        title="Understand More Than Just"
        highlight="Answers."
        description="Track speaking time, response quality trends, completion rates, and searchable transcripts — presented in a clear format recruiters can act on."
      >
        <ButtonLink to="/company-login">View dashboard</ButtonLink>
        <ButtonLink to="/features" variant="ghost">
          Explore features
        </ButtonLink>
      </PageHero>
      <AnalyticsSection />
      <TranscriptionSection />
      <RecruiterDashboard />
      <CTASection />
    </MarketingPageShell>
  );
}
