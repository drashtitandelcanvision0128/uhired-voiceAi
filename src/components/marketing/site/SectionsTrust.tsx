import {
  Building2,
  Check,
  Clock,
  Database,
  FileLock2,
  Gauge,
  KeyRound,
  Layers3,
  Lock,
  Minus,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import { ButtonLink, Card, Panel, Reveal, Section, SectionHead, Waveform } from "./shared";

/* ---------------- Security ---------------- */

const security = [
  { Icon: Lock, title: "Encrypted Data", copy: "Interview data encrypted in transit and at rest." },
  { Icon: KeyRound, title: "Secure Authentication", copy: "Modern session handling for every account." },
  { Icon: Users, title: "Role-Based Access", copy: "Recruiters see only what their role permits." },
  { Icon: Layers3, title: "Company Isolation", copy: "Each organization's data stays logically separated." },
  { Icon: Workflow, title: "Secure API Architecture", copy: "Scoped, validated, server-side access paths." },
  { Icon: ScrollText, title: "Audit Logging", copy: "Traceable access and administrative activity." },
  { Icon: FileLock2, title: "Protected Candidate Data", copy: "Personal data handled with strict controls." },
  { Icon: Clock, title: "Controlled Data Retention", copy: "Configurable retention windows per organization." },
];

export function SecuritySection() {
  return (
    <Section id="security" className="border-y border-border bg-surface/30">
      <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div>
          <SectionHead
            eyebrow="Security & privacy"
            title="Enterprise-Grade Security for Every"
            highlight="Interview."
            description="Candidate conversations and recruitment data require strong protection. Uhired AI is designed with security and privacy as core principles."
          />
        </div>
        <Reveal delay={100}>
          <div
            className="w-full rounded-2xl border border-border bg-gradient-to-br from-primary/20 via-surface-2 to-violet/20 p-12"
            style={{ boxShadow: "var(--shadow-panel)" }}
            role="img"
            aria-label="Illustration of secured AI infrastructure protecting interview data"
          >
            <div className="mx-auto grid max-w-sm place-items-center gap-4 text-center">
              <ShieldCheck className="h-16 w-16 text-cyan" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                Enterprise-grade encryption and company-level isolation for every interview session.
              </p>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {security.map(({ Icon, title, copy }, i) => (
          <Reveal key={title} delay={i * 55}>
            <Card className="h-full p-5">
              <Icon className="h-5 w-5 text-cyan" aria-hidden="true" />
              <h3 className="mt-4 text-sm font-semibold">{title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{copy}</p>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ---------------- Multi-tenant ---------------- */

export function MultiTenantSection() {
  return (
    <Section>
      <SectionHead
        align="center"
        eyebrow="Architecture"
        title="Built for Modern"
        highlight="Organizations."
        description="Each organization operates in an isolated environment with controlled access to its candidates, jobs, interviews, and analytics."
      />
      <Reveal delay={80}>
        <Panel className="mt-12 p-6 sm:p-10">
          <div className="grid gap-4 sm:grid-cols-3">
            {["Organization A", "Organization B", "Organization C"].map((org) => (
              <div key={org} className="glass glow-card rounded-2xl p-5 text-center">
                <Building2 className="mx-auto h-5 w-5 text-primary" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold">{org}</p>
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-cyan/40 bg-cyan/10 px-2.5 py-1 font-mono text-[10px] tracking-widest text-cyan uppercase">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Secure workspace
                </p>
              </div>
            ))}
          </div>
          <svg viewBox="0 0 600 70" className="mt-2 w-full" aria-hidden="true">
            {["M100 4 L300 62", "M300 4 L300 62", "M500 4 L300 62"].map((d) => (
              <path
                key={d}
                d={d}
                fill="none"
                stroke="oklch(0.62 0.212 259 / 0.6)"
                strokeWidth="1.5"
                strokeDasharray="5 7"
                className="animate-dash"
              />
            ))}
          </svg>
          <div className="mx-auto max-w-md rounded-2xl border border-primary/40 bg-primary/10 p-5 text-center">
            <Database className="mx-auto h-5 w-5 text-cyan" aria-hidden="true" />
            <p className="mt-3 font-display text-base font-semibold">Secure AI Platform</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Shared intelligence, strictly separated organizational data.
            </p>
          </div>
        </Panel>
      </Reveal>
    </Section>
  );
}

/* ---------------- Why + comparison ---------------- */

const why = [
  { Icon: Clock, title: "Save Recruiter Time", copy: "Automate first-round interviews entirely." },
  { Icon: Layers3, title: "Consistent Interviews", copy: "Every candidate gets the same structure." },
  { Icon: Gauge, title: "Structured Evaluation", copy: "Scores tied to criteria you define." },
  { Icon: Sparkles, title: "Faster Screening", copy: "Hundreds of applicants qualified in minutes." },
  { Icon: Workflow, title: "Scalable Hiring", copy: "Volume hiring without adding headcount." },
  { Icon: Users, title: "Better Candidate Insights", copy: "Transcripts, analytics, and summaries in one place." },
];

const comparison = [
  ["Manual Screening", "AI Screening"],
  ["Manual Scheduling", "Automated Interviews"],
  ["Inconsistent Interviews", "Structured Interviews"],
  ["Limited Interview Data", "Rich Interview Intelligence"],
  ["Slow Candidate Review", "Automated Candidate Insights"],
  ["Recruiter-Heavy Process", "Scalable Hiring"],
];

export function WhyAndComparison() {
  return (
    <Section className="border-y border-border bg-surface/30">
      <SectionHead align="center" eyebrow="Why Uhired AI" title="Why Teams Choose" highlight="AI-Powered Hiring." />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {why.map(({ Icon, title, copy }, i) => (
          <Reveal key={title} delay={i * 60}>
            <Card className="h-full">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy}</p>
            </Card>
          </Reveal>
        ))}
      </div>

      <div className="mt-20">
        <SectionHead align="center" title="Traditional Screening vs" highlight="AI-Powered Hiring" />
        <Reveal delay={80}>
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <div className="glass rounded-2xl p-6">
              <h3 className="text-sm tracking-widest text-muted-foreground uppercase">Traditional hiring</h3>
              <ul className="mt-5 space-y-3">
                {comparison.map(([t]) => (
                  <li key={t} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Minus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div
              className="rounded-2xl border border-primary/45 bg-primary/8 p-6"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              <h3 className="text-sm tracking-widest text-accent uppercase">Uhired AI</h3>
              <ul className="mt-5 space-y-3">
                {comparison.map(([, u]) => (
                  <li key={u} className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 shrink-0 text-success" aria-hidden="true" /> {u}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

/* ---------------- CTA ---------------- */

export function CTASection() {
  return (
    <Section id="cta" className="relative overflow-hidden">
      <div aria-hidden="true" className="aurora absolute inset-0 opacity-35" />
      <div aria-hidden="true" className="neural-grid absolute inset-0" />
      <Reveal className="relative">
        <Panel className="overflow-hidden p-8 text-center sm:p-14">
          <h2 className="text-3xl leading-tight font-semibold sm:text-4xl lg:text-5xl">
            Ready to Transform Your <span className="text-gradient">Hiring Process?</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Experience how AI-powered voice interviews can make candidate screening faster, smarter, and more
            scalable.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink to="/contact">Start Hiring Smarter</ButtonLink>
            <ButtonLink to="/contact" variant="ghost">
              Book a Demo
            </ButtonLink>
          </div>
          <Waveform className="mt-10 h-14 opacity-70" bars={64} />
        </Panel>
      </Reveal>
    </Section>
  );
}