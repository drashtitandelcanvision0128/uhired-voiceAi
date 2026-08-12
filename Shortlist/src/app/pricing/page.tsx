import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPageShell } from "@/components/marketing/site/marketing-page-shell";
import { PageHero } from "@/components/marketing/site/page-hero";
import { ButtonLink, Card, Section } from "@/components/marketing/site/shared";
import { CTASection } from "@/components/marketing/site/SectionsTrust";
import { getPracticeBasePriceRupees } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Transparent pricing for Uhired AI mock interview practice and company hiring workflows.",
};

export default function PricingPage() {
  const basePrice = getPracticeBasePriceRupees();

  return (
    <MarketingPageShell>
      <PageHero
        eyebrow="Pricing"
        title="Simple Plans for"
        highlight="Candidates & Teams."
        description="Pay-as-you-go practice interviews for candidates. Custom company plans for AI voice hiring, dashboards, and structured evaluation."
      >
        <ButtonLink to="/practice">Start practice</ButtonLink>
        <ButtonLink to="/contact" variant="ghost">
          Contact sales
        </ButtonLink>
      </PageHero>

      <Section>
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-8">
            <h2 className="text-xl font-semibold">Practice interviews</h2>
            <p className="mt-3 text-4xl font-semibold text-gradient">
              ₹{basePrice}
              <span className="text-base font-medium text-muted-foreground"> / 10 min</span>
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>AI voice mock interview</li>
              <li>Instant scorecard with dimension scores</li>
              <li>Promo codes supported</li>
            </ul>
            <Link
              href="/practice"
              className="mt-8 inline-flex rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground no-underline"
              style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-glow)" }}
            >
              Start practice
            </Link>
          </Card>

          <Card className="p-8">
            <h2 className="text-xl font-semibold">Company hiring</h2>
            <p className="mt-3 text-4xl font-semibold text-gradient">Custom</p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>Structured requirements & bulk invites</li>
              <li>Live AI voice interviews + recording</li>
              <li>Admin dashboard, share links, PDF export</li>
              <li>Optional ATS webhook integrations</li>
            </ul>
            <Link
              href="/company-register"
              className="mt-8 inline-flex rounded-xl border border-border bg-surface/60 px-5 py-3 text-sm font-semibold text-foreground no-underline transition-colors hover:border-primary/50"
            >
              Create company workspace
            </Link>
          </Card>
        </div>
      </Section>

      <CTASection />
    </MarketingPageShell>
  );
}
