import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { MarketingBackground } from "@/components/marketing/site/marketing-page-shell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Read the terms and conditions for using the Uhired AI interview platform.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <div className="space-y-3 leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function TermsOfServicePage() {
  return (
    <div className="relative min-h-screen flex flex-col bg-background selection:bg-primary/10">
      <MarketingBackground />
      <SiteHeader />

      <main className="flex-1">
        <section className="relative overflow-hidden pt-24 pb-12 md:pt-32 md:pb-16">
          <div className="absolute top-0 left-1/4 h-[500px] w-[500px] animate-pulse rounded-full bg-primary/10 blur-[100px]" />
          <div className="absolute top-40 right-1/4 h-[400px] w-[400px] animate-pulse rounded-full bg-accent/10 blur-[100px] delay-700" />

          <div className="container relative z-10 max-w-3xl text-center">
            <h1 className="mb-4 text-4xl font-extrabold leading-[1.15] tracking-tight md:text-5xl">
              Terms of Service
            </h1>
            <p className="text-muted-foreground">Last updated: July 14, 2026</p>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="container max-w-3xl space-y-10 text-[15px] md:text-base">
            <p className="leading-relaxed text-muted-foreground">
              These Terms of Service (&quot;Terms&quot;) govern your access to
              and use of the Uhired website and AI interview platform (the
              &quot;Service&quot;). By accessing or using the Service, you agree
              to these Terms. If you do not agree, do not use the Service.
            </p>

            <Section title="1. Who May Use the Service">
              <p>
                You must be at least 16 years old (or the age of majority in
                your jurisdiction, if higher) to use the Service. If you use the
                Service on behalf of a company, you represent that you have
                authority to bind that company to these Terms.
              </p>
            </Section>

            <Section title="2. Accounts and Access">
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  You are responsible for maintaining the confidentiality of
                  your login credentials and for all activity under your
                  account.
                </li>
                <li>
                  Company administrators are responsible for authorized users
                  and candidates invited through their account.
                </li>
                <li>
                  We may suspend or terminate access if we reasonably believe
                  you have violated these Terms or put the Service or other
                  users at risk.
                </li>
              </ul>
            </Section>

            <Section title="3. The Service">
              <p>
                Uhired provides AI-assisted interview practice, company
                interview sessions, feedback, scoring, and related tools.
                Features may change over time. AI-generated feedback, scores,
                and suggestions are tools to support preparation and evaluation
                — they are not guarantees of hiring outcomes or professional
                advice.
              </p>
            </Section>

            <Section title="4. Acceptable Use">
              <p>You agree not to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Use the Service for any unlawful purpose</li>
                <li>
                  Attempt to reverse engineer, scrape, overload, or disrupt the
                  Service or its infrastructure
                </li>
                <li>
                  Impersonate others, misrepresent your identity, or share
                  access codes not intended for you
                </li>
                <li>
                  Upload malware or harmful content, or harass other users
                </li>
                <li>
                  Use interview recordings or candidate data except as permitted
                  by law and your agreements with candidates
                </li>
                <li>
                  Misuse AI features to generate spam, deepfakes, or deceptive
                  content unrelated to legitimate interview use
                </li>
              </ul>
            </Section>

            <Section title="5. User Content">
              <p>
                You retain ownership of content you submit (such as resumes,
                answers, and recordings). You grant Uhired a worldwide,
                non-exclusive license to host, process, and display that content
                as needed to operate and improve the Service, including through
                AI providers. Company customers remain responsible for obtaining
                any consents required to interview candidates using the Service.
              </p>
            </Section>

            <Section title="6. Payments">
              <p>
                Paid features (such as practice sessions or subscriptions) are
                charged as described at the time of purchase. Fees are generally
                non-refundable except where required by law or as we expressly
                state. Payment processing is handled by third-party providers
                subject to their terms.
              </p>
            </Section>

            <Section title="7. Intellectual Property">
              <p>
                The Service, including software, branding, designs, and
                documentation, is owned by Uhired or its licensors. You may not
                copy, modify, or distribute our materials except as allowed by
                these Terms or with our written permission.
              </p>
            </Section>

            <Section title="8. Disclaimers">
              <p>
                THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS
                AVAILABLE.&quot; TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE
                DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING
                MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
                NON-INFRINGEMENT. We do not warrant that the Service will be
                uninterrupted, error-free, or that AI outputs will be accurate
                or complete.
              </p>
            </Section>

            <Section title="9. Limitation of Liability">
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, UHIRED AND ITS
                AFFILIATES WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL,
                SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST
                PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE
                SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM RELATED TO THE
                SERVICE WILL NOT EXCEED THE AMOUNTS YOU PAID US IN THE TWELVE
                (12) MONTHS BEFORE THE CLAIM.
              </p>
            </Section>

            <Section title="10. Indemnification">
              <p>
                You agree to indemnify and hold Uhired harmless from claims,
                damages, and expenses arising from your use of the Service,
                your content, or your violation of these Terms or applicable
                law — including claims related to candidate interviews you
                conduct on the platform.
              </p>
            </Section>

            <Section title="11. Privacy">
              <p>
                Our collection and use of personal information is described in
                our{" "}
                <Link href="/privacy" className="text-blue-600 hover:underline">
                  Privacy Policy
                </Link>
                , which forms part of these Terms.
              </p>
            </Section>

            <Section title="12. Changes">
              <p>
                We may update these Terms from time to time. We will post the
                revised Terms on this page and update the &quot;Last
                updated&quot; date. Continued use after changes constitutes
                acceptance of the updated Terms.
              </p>
            </Section>

            <Section title="13. Termination">
              <p>
                You may stop using the Service at any time. We may suspend or
                end access for any reason, including breach of these Terms.
                Provisions that by nature should survive (including ownership,
                disclaimers, and liability limits) will survive termination.
              </p>
            </Section>

            <Section title="14. Governing Law">
              <p>
                These Terms are governed by the laws applicable in our primary
                place of business, without regard to conflict-of-law rules.
                Courts in that jurisdiction will have exclusive venue for
                disputes, except where prohibited by local consumer law.
              </p>
            </Section>

            <Section title="15. Contact">
              <p>
                Questions about these Terms? Email{" "}
                <a
                  href="mailto:no-reply@uhired.in"
                  className="text-blue-600 hover:underline"
                >
                  no-reply@uhired.in
                </a>{" "}
                or visit our{" "}
                <Link href="/contact" className="text-blue-600 hover:underline">
                  Contact
                </Link>{" "}
                page.
              </p>
            </Section>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
