import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/site/marketing-page-shell";
import { PageHero } from "@/components/marketing/site/page-hero";
import { ButtonLink } from "@/components/marketing/site/shared";
import { AIScreeningSection } from "@/components/marketing/site/SectionsIntelligence";
import { CTASection } from "@/components/marketing/site/SectionsTrust";

export const metadata: Metadata = {
  title: "Candidate Screening",
  description:
    "Screen hundreds of candidates in minutes with AI-powered requirement matching and ranked shortlists.",
};

export default function CandidateScreeningPage() {
  return (
    <MarketingPageShell>
      <PageHero
        eyebrow="Smart screening"
        title="Screen Hundreds of Candidates in"
        highlight="Minutes."
        description="Automatically identify candidates who match your job requirements before recruiters spend time on first-round interviews."
      >
        <ButtonLink to="/company-register">Start screening</ButtonLink>
        <ButtonLink to="/features" variant="ghost">
          All features
        </ButtonLink>
      </PageHero>
      <AIScreeningSection />
      <CTASection />
    </MarketingPageShell>
  );
}
