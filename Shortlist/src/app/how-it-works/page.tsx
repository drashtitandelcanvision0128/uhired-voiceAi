import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/site/marketing-page-shell";
import { PageHero } from "@/components/marketing/site/page-hero";
import { ButtonLink } from "@/components/marketing/site/shared";
import { FlowSection } from "@/components/marketing/site/SectionsInterview";
import { JobCreationSection, LiveStatusSection } from "@/components/marketing/site/SectionsPlatform";
import { WhyAndComparison, CTASection } from "@/components/marketing/site/SectionsTrust";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "See how Uhired AI takes candidates from application to AI voice interview to structured shortlist in six clear steps.",
};

export default function HowItWorksPage() {
  return (
    <MarketingPageShell>
      <PageHero
        eyebrow="Interview flow"
        title="From Application to"
        highlight="AI-Powered Decision."
        description="Define the role, let AI screen and interview candidates, then review rich scorecards and transcripts before you shortlist — all in one workflow."
      >
        <ButtonLink to="/company-register">Set up your first role</ButtonLink>
        <ButtonLink to="/for-recruiters" variant="ghost">
          For recruiters
        </ButtonLink>
      </PageHero>
      <FlowSection />
      <JobCreationSection />
      <LiveStatusSection />
      <WhyAndComparison />
      <CTASection />
    </MarketingPageShell>
  );
}
