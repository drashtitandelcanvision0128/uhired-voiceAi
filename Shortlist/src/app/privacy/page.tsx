import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { MarketingBackground } from "@/components/marketing/site/marketing-page-shell";
import { PrivacyDeleteForm } from "@/components/marketing/privacy-delete-form";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how Uhired collects, uses, and protects your personal information.",
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

export default function PrivacyPolicyPage() {
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
              Privacy Policy
            </h1>
            <p className="text-muted-foreground">Last updated: July 14, 2026</p>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="container max-w-3xl space-y-10 text-[15px] md:text-base">
            <p className="leading-relaxed text-muted-foreground">
              Uhired (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is
              committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, store, and share information when
              you use our website and AI interview platform (the
              &quot;Service&quot;).
            </p>

            <Section title="1. Information We Collect">
              <p>We may collect the following types of information:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-slate-800">Account information:</strong>{" "}
                  name, email address, company details, and credentials used to
                  access the Service.
                </li>
                <li>
                  <strong className="text-slate-800">Interview data:</strong>{" "}
                  responses, recordings (where enabled), transcripts, scores,
                  and feedback generated during practice or company interview
                  sessions.
                </li>
                <li>
                  <strong className="text-slate-800">Usage data:</strong> pages
                  visited, features used, device/browser type, IP address, and
                  similar technical information.
                </li>
                <li>
                  <strong className="text-slate-800">Payment information:</strong>{" "}
                  billing details processed by our payment providers for paid
                  features. We do not store full card numbers on our servers.
                </li>
              </ul>
            </Section>

            <Section title="2. How We Use Your Information">
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Provide, operate, and improve the Service</li>
                <li>Run AI-powered interview sessions and generate feedback</li>
                <li>
                  Authenticate users and manage company or candidate accounts
                </li>
                <li>Process payments and send related receipts or notices</li>
                <li>
                  Respond to support requests and communicate about the Service
                </li>
                <li>
                  Detect, prevent, and address fraud, abuse, or security issues
                </li>
                <li>Comply with legal obligations</li>
              </ul>
            </Section>

            <Section title="3. AI Processing">
              <p>
                Interview content you submit may be processed by third-party AI
                providers to generate questions, evaluations, and coaching
                feedback. We use this data only to deliver and improve the
                Service. You should not submit sensitive personal data you do
                not want processed for these purposes.
              </p>
            </Section>

            <Section title="4. How We Share Information">
              <p>
                We do not sell your personal information. We may share
                information with:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong className="text-slate-800">Service providers</strong>{" "}
                  who help us operate hosting, AI, payments, email, and
                  analytics — under appropriate confidentiality obligations
                </li>
                <li>
                  <strong className="text-slate-800">Company customers</strong>{" "}
                  when candidates participate in interviews initiated by that
                  company (e.g., session results shared with the hiring team)
                </li>
                <li>
                  <strong className="text-slate-800">Legal authorities</strong>{" "}
                  when required by law or to protect our rights, users, or the
                  public
                </li>
              </ul>
            </Section>

            <Section title="5. Data Retention">
              <p>
                We retain personal and interview data for as long as needed to
                provide the Service, fulfill the purposes described in this
                policy, meet legal or accounting requirements, or resolve
                disputes. Company customers may control retention of session
                data associated with their accounts subject to our agreements
                with them.
              </p>
            </Section>

            <Section title="6. Security">
              <p>
                We implement reasonable technical and organizational measures to
                protect your information. No method of transmission or storage
                is completely secure, and we cannot guarantee absolute security.
              </p>
            </Section>

            <Section title="7. Your Choices">
              <p>Depending on your location, you may have rights to:</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Access, correct, or delete personal information we hold</li>
                <li>Object to or restrict certain processing</li>
                <li>Request a copy of your data in a portable format</li>
                <li>Withdraw consent where processing is based on consent</li>
              </ul>
              <p>
                To exercise these rights, contact us at{" "}
                <a
                  href="mailto:support@uhired.in"
                  className="text-blue-600 hover:underline"
                >
                  support@uhired.in
                </a>
                , or use the self-service form below for practice interview data.
              </p>
              <PrivacyDeleteForm />
            </Section>

            <Section title="8. Cookies and Similar Technologies">
              <p>
                We use cookies and similar technologies for authentication,
                preferences, and understanding how the Service is used. You can
                control cookies through your browser settings; disabling some
                cookies may limit functionality.
              </p>
            </Section>

            <Section title="9. Children's Privacy">
              <p>
                The Service is not directed to children under 16. We do not
                knowingly collect personal information from children. If you
                believe a child has provided us information, contact us and we
                will take appropriate steps to delete it.
              </p>
            </Section>

            <Section title="10. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. We will
                post the revised version on this page and update the &quot;Last
                updated&quot; date. Continued use of the Service after changes
                means you accept the updated policy.
              </p>
            </Section>

            <Section title="11. Contact Us">
              <p>
                Questions about this Privacy Policy? Email us at{" "}
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
