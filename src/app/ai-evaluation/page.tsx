import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/site/marketing-page-shell";
import { PageHero } from "@/components/marketing/site/page-hero";
import { ButtonLink } from "@/components/marketing/site/shared";
import { EvaluationSection, ReportSection } from "@/components/marketing/site/SectionsIntelligence";
import { CTASection } from "@/components/marketing/site/SectionsTrust";

export const metadata: Metadata = {
  title: "AI Evaluation",
  description:
    "Structured AI evaluation against role-specific criteria with scorecards, summaries, and recruiter decision support.",
};

export default function AiEvaluationPage() {
  return (
    <MarketingPageShell>
      <PageHero
        eyebrow="Candidate evaluation"
        title="Turn Conversations Into"
        highlight="Candidate Intelligence."
        description="Uhired AI analyzes interview responses against the structured evaluation criteria you define for each role — with transparent, decision-support scoring."
      >
        <ButtonLink to="/company-register">Create evaluation criteria</ButtonLink>
        <ButtonLink to="/for-recruiters" variant="ghost">
          Recruiter dashboard
        </ButtonLink>
      </PageHero>
      <EvaluationSection />
      <ReportSection />
      <CTASection />
    </MarketingPageShell>
  );
}
