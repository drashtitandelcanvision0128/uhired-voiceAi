import type { Metadata } from "next";
import { MarketingPageShell } from "@/components/marketing/site/marketing-page-shell";
import { PageHero } from "@/components/marketing/site/page-hero";
import { ContactForm } from "@/components/marketing/contact-form";
import { ContactFaq } from "@/components/marketing/contact-faq";
import { ButtonLink, Panel, Section } from "@/components/marketing/site/shared";
import { CTASection } from "@/components/marketing/site/SectionsTrust";
import { Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the Uhired team for support, partnerships, or enterprise hiring questions.",
};

export default function ContactPage() {
  return (
    <MarketingPageShell>
      <PageHero
        eyebrow="Get in touch"
        title="Contact"
        highlight="Us."
        description="Have questions about AI voice interviews, company onboarding, or enterprise plans? Send us a message and we'll respond as soon as possible."
      >
        <ButtonLink to="/company-register">Get started</ButtonLink>
        <ButtonLink to="/help" variant="ghost">
          Help center
        </ButtonLink>
      </PageHero>

      <Section>
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.4fr]">
          <Panel className="p-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/40 bg-primary/12">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Email</h2>
            <p className="mt-2 text-sm text-muted-foreground">no-reply@uhired.in</p>
            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              For enterprise volume, ATS integrations, or security reviews, mention your company name and
              expected interview volume in your message.
            </p>
          </Panel>
          <Panel className="p-6 md:p-8">
            <h2 className="mb-6 text-xl font-semibold">Send us a message</h2>
            <ContactForm />
          </Panel>
        </div>
      </Section>

      <Section className="border-t border-border bg-surface/30">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-semibold sm:text-4xl">Frequently Asked Questions</h2>
          <p className="mt-3 text-muted-foreground">Common questions about Uhired AI</p>
        </div>
        <ContactFaq />
      </Section>

      <CTASection />
    </MarketingPageShell>
  );
}
