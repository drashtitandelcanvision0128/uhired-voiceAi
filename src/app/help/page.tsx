import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/site/marketing-page-shell";
import { PageHero } from "@/components/marketing/site/page-hero";
import { ButtonLink } from "@/components/marketing/site/shared";
import { CTASection } from "@/components/marketing/site/SectionsTrust";
import { HELP_SECTIONS, HelpCenterView } from "@/components/marketing/help-center-view";

export const metadata: Metadata = {
  title: "Help Center",
  description:
    "Answers about Uhired mock interviews, practice sessions, payments, scorecards, and company hiring workflows.",
};

export default function HelpCenterPage() {
  return (
    <MarketingPageShell>
      <PageHero
        eyebrow="Help center"
        title="How Can We"
        highlight="Help?"
        description="Quick answers about practice interviews, payments, scorecards, and company hiring. Search articles below or jump to a topic."
      >
        <ButtonLink to="/contact">Contact support</ButtonLink>
        <ButtonLink to="/practice" variant="ghost">
          Start practice
        </ButtonLink>
      </PageHero>

      <HelpCenterView sections={HELP_SECTIONS} />

      <CTASection />
    </MarketingPageShell>
  );
}
