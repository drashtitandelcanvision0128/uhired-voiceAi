import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/site/marketing-page-shell";
import { PageHero } from "@/components/marketing/site/page-hero";
import { ButtonLink } from "@/components/marketing/site/shared";
import { CandidateExperience } from "@/components/marketing/site/SectionsPlatform";
import { VoiceInterviewSection } from "@/components/marketing/site/SectionsInterview";
import { CTASection } from "@/components/marketing/site/SectionsTrust";

export const metadata: Metadata = {
  title: "For Candidates",
  description:
    "A calm, guided AI interview experience with device checks, live transcript, and visible progress for every candidate.",
};

export default function ForCandidatesPage() {
  return (
    <MarketingPageShell>
      <PageHero
        eyebrow="For candidates"
        title="Designed for"
        highlight="Candidates, Too."
        description="Clear device checks, transparent AI states, live transcripts, and visible progress — so candidates know exactly what to expect during every voice interview."
      >
        <ButtonLink to="/practice">Practice mock interviews</ButtonLink>
        <ButtonLink to="/candidate/history" variant="ghost">
          My interviews
        </ButtonLink>
      </PageHero>
      <CandidateExperience />
      <VoiceInterviewSection />
      <CTASection />
    </MarketingPageShell>
  );
}
