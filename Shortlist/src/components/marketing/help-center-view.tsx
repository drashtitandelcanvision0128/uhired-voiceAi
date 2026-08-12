"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronDown,
  CreditCard,
  LifeBuoy,
  MessageSquare,
  Search,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card, IconBadge, Panel, Reveal, Section } from "@/components/marketing/site/shared";

export type HelpFaqItem = {
  question: string;
  answer: string;
};

export type HelpSection = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  faqs: HelpFaqItem[];
};

const QUICK_LINKS = [
  { label: "Start practice", href: "/practice", description: "AI mock interviews" },
  { label: "Company sign in", href: "/company-login", description: "Recruiter dashboard" },
  { label: "Contact support", href: "/contact", description: "Get human help" },
  { label: "Privacy policy", href: "/privacy", description: "Data & security" },
];

function HelpFaqAccordion({ items }: { items: HelpFaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (items.length === 0) {
    return (
      <Panel className="p-6 text-center text-sm text-muted-foreground">
        No articles match your search. Try different keywords or{" "}
        <Link href="/contact" className="text-primary no-underline hover:text-cyan">
          contact us
        </Link>
        .
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={item.question} className="glass glow-card overflow-hidden rounded-2xl">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:text-foreground"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-semibold md:text-base">{item.question}</span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-cyan transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {isOpen ? (
              <div className="border-t border-border px-5 pb-5 pt-3">
                <p className="text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function HelpCenterView({ sections }: { sections: HelpSection[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    if (!normalizedQuery) return sections;
    return sections
      .map((section) => ({
        ...section,
        faqs: section.faqs.filter(
          (faq) =>
            faq.question.toLowerCase().includes(normalizedQuery) ||
            faq.answer.toLowerCase().includes(normalizedQuery) ||
            section.title.toLowerCase().includes(normalizedQuery),
        ),
      }))
      .filter((section) => section.faqs.length > 0);
  }, [sections, normalizedQuery]);

  const totalResults = filteredSections.reduce((n, s) => n + s.faqs.length, 0);

  return (
    <>
      <Section tight className="border-b border-border bg-surface/20">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <Panel className="p-5 sm:p-6">
            <label htmlFor="help-search" className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-accent uppercase">
              <Search className="h-3.5 w-3.5" aria-hidden="true" /> Search help articles
            </label>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="help-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Payments, scorecards, company login…"
                className="w-full rounded-xl border border-border bg-surface/60 py-3.5 pl-11 pr-4 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-4 focus:ring-primary/15"
              />
            </div>
            <p className="mt-3 font-mono text-[11px] text-muted-foreground">
              {normalizedQuery
                ? `${totalResults} article${totalResults === 1 ? "" : "s"} found`
                : `${sections.reduce((n, s) => n + s.faqs.length, 0)} articles across ${sections.length} topics`}
            </p>
          </Panel>

          <div className="grid gap-3 sm:grid-cols-2">
            {QUICK_LINKS.map((link, i) => (
              <Reveal key={link.label} delay={i * 60}>
                <Link
                  href={link.href}
                  className="glass glow-card block rounded-2xl p-4 no-underline transition-colors hover:text-foreground"
                >
                  <p className="text-sm font-semibold text-foreground">{link.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{link.description}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        {!normalizedQuery ? (
          <div className="mb-12 flex flex-wrap gap-2">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-full border border-border bg-surface/60 px-4 py-2 font-mono text-[11px] tracking-wide text-muted-foreground uppercase transition-colors hover:border-primary/50 hover:text-foreground no-underline"
              >
                {section.title}
              </a>
            ))}
          </div>
        ) : null}

        <div className="space-y-16">
          {filteredSections.map((section, sectionIndex) => {
            const Icon = section.icon;
            return (
              <Reveal key={section.id} delay={sectionIndex * 80}>
                <div id={section.id} className="scroll-mt-28">
                  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                      <IconBadge tone="cyan">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </IconBadge>
                      <div>
                        <h2 className="text-2xl font-semibold sm:text-3xl">{section.title}</h2>
                        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground sm:text-base">
                          {section.description}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                      {section.faqs.length} article{section.faqs.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <HelpFaqAccordion items={section.faqs} />
                </div>
              </Reveal>
            );
          })}
        </div>

        {filteredSections.length === 0 ? (
          <Panel className="mt-8 p-8 text-center">
            <p className="text-lg font-semibold">No matching articles</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try searching for &quot;payment&quot;, &quot;scorecard&quot;, or &quot;company login&quot;.
            </p>
          </Panel>
        ) : null}
      </Section>

      <Section tight className="border-t border-border bg-surface/30">
        <Reveal>
          <Card className="mx-auto max-w-3xl p-8 text-center sm:p-10">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-primary/40 bg-primary/12">
              <MessageSquare className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-semibold sm:text-3xl">Still stuck?</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Send us a message with your email, what you were trying to do, and any error text you saw.
              We typically reply within one business day.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground no-underline transition-all hover:-translate-y-0.5"
                style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-glow)" }}
              >
                Go to contact form
              </Link>
              <Link
                href="/company-login"
                className="inline-flex items-center justify-center rounded-xl border border-border bg-surface/60 px-5 py-3 text-sm font-semibold text-foreground no-underline transition-colors hover:border-primary/50"
              >
                Company sign in
              </Link>
            </div>
          </Card>
        </Reveal>
      </Section>
    </>
  );
}

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "practice",
    title: "Practice interviews",
    description: "Start a session, choose your role, and get AI feedback.",
    icon: Sparkles,
    faqs: [
      {
        question: "How do I start a mock interview?",
        answer:
          "Go to Practice, pick your target role and domain, then follow the checkout or promo-code step. Once ready, you'll enter a live AI interview room with real-time questions and scoring.",
      },
      {
        question: "Can I practice for a specific company or role?",
        answer:
          "Yes. Choose your role, seniority, and domain before starting. The AI tailors questions to that profile so practice feels close to a real loop.",
      },
      {
        question: "How long does a practice session last?",
        answer:
          "Duration depends on the plan or promo code you used — typically a few minutes for preview sessions and longer for paid practice. The timer is shown before you begin.",
      },
    ],
  },
  {
    id: "payments",
    title: "Payments & promo codes",
    description: "Checkout, receipts, and free-access codes.",
    icon: CreditCard,
    faqs: [
      {
        question: "What payment methods are supported?",
        answer:
          "Practice checkout is powered by Razorpay. You can pay with supported cards, UPI, and other methods shown on the payment screen.",
      },
      {
        question: "I have a promo code — where do I enter it?",
        answer:
          "On the practice flow, look for the promo code field before payment. Enter the code exactly as provided; if it's valid and active, your session unlocks without full payment.",
      },
      {
        question: "Payment succeeded but session didn't start",
        answer:
          "Wait a minute and refresh the Sessions page. If it still doesn't appear, contact us with your payment email and timestamp so we can verify the transaction.",
      },
    ],
  },
  {
    id: "sessions",
    title: "Sessions & scorecards",
    description: "Resume, review results, and share feedback.",
    icon: BookOpen,
    faqs: [
      {
        question: "Where can I see my past interviews?",
        answer:
          "Open Sessions from the main navigation. You'll see practice and invited sessions with status, date, and scorecard links when scoring is complete.",
      },
      {
        question: "When will my scorecard be ready?",
        answer:
          "Most sessions are scored within a few minutes after completion. If a session stays in progress for a long time, try refreshing or reach out via the contact form.",
      },
      {
        question: "Can I share my scorecard with a mentor or recruiter?",
        answer:
          "When available, use the share link from your scorecard page. Shared links are read-only views of your results.",
      },
    ],
  },
  {
    id: "companies",
    title: "For employers",
    description: "Company login, invites, and hiring workflows.",
    icon: Users,
    faqs: [
      {
        question: "How does company hiring on Uhired work?",
        answer:
          "Companies sign in at Company Login, create hiring requirements, and send invite links to candidates. Candidates complete AI-led interviews and employers review scorecards in their dashboard.",
      },
      {
        question: "I'm a candidate invited by a company — what should I do?",
        answer:
          "Use the invite link from the employer email. Complete the interview in one sitting if possible, and allow microphone access when prompted.",
      },
      {
        question: "How do company admins get support?",
        answer:
          "Use the support option inside your company dashboard or the public contact form. Include your company domain and admin email for faster help.",
      },
    ],
  },
  {
    id: "privacy",
    title: "Account & privacy",
    description: "Data handling and security basics.",
    icon: LifeBuoy,
    faqs: [
      {
        question: "Is my interview data private?",
        answer:
          "Your sessions are used to deliver coaching and scoring. We don't sell interview recordings to third parties. See our Privacy page for full details.",
      },
      {
        question: "How do I delete or correct my information?",
        answer:
          "Email us from the contact page with your request. Include the email address tied to your account so we can locate your data.",
      },
    ],
  },
];
