import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/site/marketing-page-shell";
import { PageHero } from "@/components/marketing/site/page-hero";
import { ButtonLink } from "@/components/marketing/site/shared";
import { AboutSection } from "@/components/marketing/site/SectionsInterview";
import {
  AIScreeningSection,
  AnalyticsSection,
  EvaluationSection,
  ReportSection,
  TranscriptionSection,
} from "@/components/marketing/site/SectionsIntelligence";
import { CTASection } from "@/components/marketing/site/SectionsTrust";

export const metadata: Metadata = {
  title: "Features",
  description:
    "AI screening, structured evaluation, live transcription, analytics, and automated reports — everything your hiring team needs.",
};

export default function FeaturesPage() {
  return (
    <MarketingPageShell>
      <PageHero
        eyebrow="Platform features"
        title="Everything You Need to Hire"
        highlight="Smarter."
        description="Automate screening, run structured voice interviews, and turn every conversation into actionable candidate intelligence — without losing recruiter control."
      >
        <ButtonLink to="/company-register">Get started</ButtonLink>
        <ButtonLink to="/platform" variant="ghost">
          Platform overview
        </ButtonLink>
      </PageHero>
      <AboutSection />
      <AIScreeningSection />
      <EvaluationSection />
      <TranscriptionSection />
      <AnalyticsSection />
      <ReportSection />
      <CTASection />
    </MarketingPageShell>
  );
}
