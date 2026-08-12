import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/site/marketing-page-shell";
import { PageHero } from "@/components/marketing/site/page-hero";
import { ButtonLink } from "@/components/marketing/site/shared";
import { TrustBar } from "@/components/marketing/site/Hero";
import { VoiceAITechnology } from "@/components/marketing/site/SectionsInterview";
import { MultiTenantSection, WhyAndComparison, CTASection } from "@/components/marketing/site/SectionsTrust";
import { InterviewTypesSection } from "@/components/marketing/site/SectionsPlatform";

export const metadata: Metadata = {
  title: "Platform",
  description:
    "Uhired AI is an end-to-end voice interview platform for screening, evaluation, analytics, and scalable hiring.",
};

export default function PlatformPage() {
  return (
    <MarketingPageShell>
      <PageHero
        eyebrow="Platform overview"
        title="One AI Platform for"
        highlight="Modern Hiring."
        description="From first application to structured shortlist — Uhired AI unifies voice interviews, automated screening, real-time transcription, and recruiter dashboards in a single workspace."
      >
        <ButtonLink to="/company-register">Start free trial</ButtonLink>
        <ButtonLink to="/how-it-works" variant="ghost">
          See how it works
        </ButtonLink>
      </PageHero>
      <TrustBar />
      <VoiceAITechnology />
      <InterviewTypesSection />
      <MultiTenantSection />
      <WhyAndComparison />
      <CTASection />
    </MarketingPageShell>
  );
}
