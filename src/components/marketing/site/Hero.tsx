import {
  Activity,
  BarChart3,
  BrainCircuit,
  FileText,
  Mic,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import {
  ButtonLink,
  Card,
  Eyebrow,
  Marquee,
  Orb,
  Reveal,
  Section,
  StatusDot,
  Tilt,
  Typewriter,
  Waveform,
} from "./shared";

function InterviewMock() {
  return (
    <div className="glass rounded-3xl p-4 sm:p-5" style={{ boxShadow: "var(--shadow-panel)" }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <StatusDot />
          <span className="font-mono text-[11px] tracking-[0.18em] text-accent uppercase">Interview live</span>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {["Voice AI", "Real-time analysis", "AI evaluation"].map((t) => (
            <span
              key={t}
              className="hidden rounded-full border border-border bg-surface-2/70 px-2.5 py-1 text-[10px] tracking-wide text-muted-foreground uppercase sm:inline"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1.35fr_1fr]">
        <div className="rounded-2xl border border-border bg-surface-2/50 p-4">
          <div className="flex items-center gap-3">
            <span className="relative grid h-10 w-10 place-items-center rounded-xl border border-primary/40 bg-primary/15 text-primary">
              <BrainCircuit className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">AI Interviewer</p>
              <p className="font-mono text-[11px] text-cyan">● Speaking</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-foreground/90">
            “Tell me about your experience working with cross-functional teams.”
          </p>
          <Waveform className="mt-4 h-12" bars={40} />
          <div className="mt-4 rounded-xl border border-border bg-background/50 p-3">
            <p className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <Mic className="h-3.5 w-3.5 text-success" aria-hidden="true" /> Candidate response · live transcript
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              “I have worked with engineering, design, and product teams to ship
              <span className="text-foreground"> quarterly release plans</span>, aligning scope with…”
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                Candidate
              </span>
              <Video className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="mt-3 grid h-24 place-items-center rounded-xl border border-border bg-surface-2/60">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <StatusDot tone="primary" /> Camera connected
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-background/60 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Interview progress</span>
              <span className="font-mono text-foreground">67%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full w-[67%] rounded-full" style={{ background: "var(--gradient-brand)" }} />
            </div>
            <dl className="mt-4 space-y-2 text-xs">
              {[
                ["AI status", "Listening"],
                ["Speech recognition", "Streaming"],
                ["Evaluation engine", "Active"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="flex items-center gap-1.5 font-mono text-foreground">
                    <StatusDot /> {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <div id="top" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[820px] bg-gradient-to-b from-primary/10 via-violet/5 to-background"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[820px] bg-gradient-to-b from-background/60 via-background/80 to-background"
      />
      <div aria-hidden="true" className="neural-grid absolute inset-x-0 top-0 h-[820px]" />
      <div aria-hidden="true" className="neural-grid animate-grid-pan absolute inset-x-0 top-0 h-[820px] opacity-60" />
      <Orb className="-top-24 -left-24 h-[420px] w-[420px] opacity-40" />
      <Orb className="top-40 -right-32 h-[460px] w-[460px] opacity-30" tone="violet" />
      <Orb className="top-[520px] left-1/3 h-[320px] w-[320px] opacity-25" tone="cyan" />

      <Section className="pt-32 sm:pt-40">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
          <Reveal from="left">
            <Eyebrow>AI voice interview platform</Eyebrow>
            <h1 className="mt-6 text-4xl leading-[1.05] font-semibold sm:text-5xl lg:text-6xl">
              Meet the Future of{" "}
              <Typewriter words={["Hiring.", "Voice Interviews.", "Candidate Screening.", "Talent Intelligence."]} />
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Uhired AI transforms candidate screening with intelligent voice interviews, real-time
              conversational AI, automated evaluation, and data-driven hiring insights.
            </p>
            <p className="mt-4 font-mono text-xs tracking-[0.18em] text-accent uppercase">
              Screen faster. Interview smarter. Hire better.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/signup">
                Start Hiring Smarter <Sparkles className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
              <ButtonLink href="#ai-interviews" variant="ghost">
                Try AI Interview <Mic className="h-4 w-4" aria-hidden="true" />
              </ButtonLink>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted-foreground">
              {[
                { Icon: ShieldCheck, label: "Encrypted interview data" },
                { Icon: Activity, label: "Real-time transcription" },
                { Icon: BarChart3, label: "Structured evaluation" },
              ].map(({ Icon, label }) => (
                <li key={label} className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" /> {label}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal from="right" delay={120}>
            <Tilt className="animate-float-slow">
              <InterviewMock />
            </Tilt>
          </Reveal>
        </div>
      </Section>
    </div>
  );
}

const trust = [
  { Icon: Mic, title: "AI Voice Interviews", copy: "Natural conversational interviews at any scale." },
  { Icon: ScanSearch, title: "Automated Screening", copy: "Rank applicants against role requirements." },
  { Icon: BrainCircuit, title: "Smart Evaluation", copy: "Structured scoring across defined criteria." },
  { Icon: FileText, title: "Real-time Transcription", copy: "Speaker-separated, timestamped records." },
  { Icon: BarChart3, title: "Candidate Insights", copy: "Signal-rich analytics for every conversation." },
  { Icon: ShieldCheck, title: "Structured Hiring", copy: "Consistent process for every candidate." },
];

export function TrustBar() {
  return (
    <Section tight id="platform">
      <Reveal className="text-center">
        <p className="font-mono text-xs tracking-[0.22em] text-muted-foreground uppercase">
          AI-powered candidate intelligence
        </p>
      </Reveal>
      <Marquee className="mt-6">
        {[
          "Voice AI",
          "Real-time transcription",
          "Automated screening",
          "Structured scorecards",
          "Bias-aware evaluation",
          "Hiring analytics",
          "Dedicated company workspaces",
        ].map((t) => (
          <span
            key={t}
            className="rounded-full border border-border bg-surface/60 px-4 py-2 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase"
          >
            {t}
          </span>
        ))}
      </Marquee>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {trust.map(({ Icon, title, copy }, i) => (
          <Reveal key={title} delay={i * 80} from="zoom">
            <Card className="h-full p-5">
              <Icon className="h-6 w-6 text-primary transition-transform duration-300 group-hover:scale-110" aria-hidden="true" />
              <h3 className="mt-4 text-sm font-semibold">{title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{copy}</p>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}