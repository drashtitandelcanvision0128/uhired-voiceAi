import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/site/marketing-page-shell";
import { PageHero } from "@/components/marketing/site/page-hero";
import { ButtonLink } from "@/components/marketing/site/shared";
import { AnalyticsSection, ReportSection } from "@/components/marketing/site/SectionsIntelligence";
import {
  JobCreationSection,
  RecruiterDashboard,
} from "@/components/marketing/site/SectionsPlatform";
import { CTASection } from "@/components/marketing/site/SectionsTrust";

export const metadata: Metadata = {
  title: "For Recruiters",
  description:
    "One recruiter dashboard for every candidate — AI scores, transcripts, filters, and structured shortlists.",
};

export default function ForRecruitersPage() {
  return (
    <MarketingPageShell>
      <PageHero
        eyebrow="For recruiters"
        title="One Dashboard."
        highlight="Every Candidate."
        description="Review AI interview results, compare match scores, filter pipelines, and make faster hiring decisions with full context on every conversation."
      >
        <ButtonLink to="/company-login">Sign in to dashboard</ButtonLink>
        <ButtonLink to="/company-register" variant="ghost">
          Register your company
        </ButtonLink>
      </PageHero>
      <RecruiterDashboard />
      <JobCreationSection />
      <AnalyticsSection />
      <ReportSection />
      <CTASection />
    </MarketingPageShell>
  );
}
