import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/site/marketing-page-shell";
import { PageHero } from "@/components/marketing/site/page-hero";
import { ButtonLink } from "@/components/marketing/site/shared";
import {
  DynamicInterviewSection,
  VoiceAITechnology,
  VoiceInterviewSection,
} from "@/components/marketing/site/SectionsInterview";
import { LiveStatusSection, InterviewTypesSection } from "@/components/marketing/site/SectionsPlatform";
import { CTASection } from "@/components/marketing/site/SectionsTrust";

export const metadata: Metadata = {
  title: "AI Interviews",
  description:
    "Natural conversational AI voice interviews with dynamic follow-ups, real-time transcription, and structured evaluation.",
};

export default function AiInterviewsPage() {
  return (
    <MarketingPageShell>
      <PageHero
        eyebrow="AI voice interviews"
        title="Interviews That Feel"
        highlight="Human."
        description="Uhired AI conducts natural voice interviews that adapt to each candidate — with live transcription, voice activity detection, and intelligent follow-up questions."
      >
        <ButtonLink to="/company-register">Create AI interview</ButtonLink>
        <ButtonLink to="/for-candidates" variant="ghost">
          Candidate experience
        </ButtonLink>
      </PageHero>
      <VoiceInterviewSection />
      <DynamicInterviewSection />
      <VoiceAITechnology />
      <LiveStatusSection />
      <InterviewTypesSection />
      <CTASection />
    </MarketingPageShell>
  );
}
