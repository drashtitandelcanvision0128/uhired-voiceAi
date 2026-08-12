import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/site/marketing-page-shell";
import { PageHero } from "@/components/marketing/site/page-hero";
import { ButtonLink } from "@/components/marketing/site/shared";
import { MultiTenantSection, SecuritySection, CTASection } from "@/components/marketing/site/SectionsTrust";

export const metadata: Metadata = {
  title: "Security & Privacy",
  description:
    "Enterprise-grade security for AI voice interviews — encryption, tenant isolation, RBAC, audit logging, and controlled data retention.",
};

export default function SecurityPage() {
  return (
    <MarketingPageShell>
      <PageHero
        eyebrow="Security & privacy"
        title="Enterprise-Grade Security for Every"
        highlight="Interview."
        description="Candidate conversations and recruitment data require strong protection. Uhired AI is built with security and privacy as core principles — not add-ons."
      >
        <ButtonLink to="/privacy">Privacy policy</ButtonLink>
        <ButtonLink to="/contact" variant="ghost">
          Talk to our team
        </ButtonLink>
      </PageHero>
      <SecuritySection />
      <MultiTenantSection />
      <CTASection />
    </MarketingPageShell>
  );
}
