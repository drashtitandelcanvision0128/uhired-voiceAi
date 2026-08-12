import {
  ArrowRight,
  AudioLines,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  GitBranch,
  Layers,
  ListChecks,
  Mic,
  Radio,
  Speech,
  UserRoundCheck,
  Users,
  Volume2,
} from "lucide-react";
import { Card, Counter, Eyebrow, Panel, Reveal, ScoreBar, Section, SectionHead, StatusDot, Waveform } from "./shared";

/* ---------------- About / command center ---------------- */

export function AboutSection() {
  const stack = [
    "Conversational AI",
    "Voice technology",
    "Speech recognition",
    "Large language models",
    "Automated evaluation",
    "Interview analytics",
    "Recruiter dashboards",
  ];
  return (
    <Section id="features">
      <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHead
            eyebrow="About Uhired AI"
            title="Reimagining the Hiring Process with"
            highlight="AI"
            description="Uhired AI helps organizations automate the most time-consuming parts of recruitment while keeping the interview experience natural, structured, and human-centric."
          />
          <ul className="mt-8 flex flex-wrap gap-2">
            {stack.map((s, i) => (
              <Reveal as="li" key={s} delay={i * 50}>
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3.5 py-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  {s}
                </span>
              </Reveal>
            ))}
          </ul>
        </div>

        <Reveal delay={100}>
          <Panel className="p-5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] tracking-[0.18em] text-accent uppercase">
                Recruitment command center
              </p>
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                <StatusDot /> live
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                ["Pipeline", 248],
                ["Interviewed", 132],
                ["Shortlisted", 42],
              ].map(([label, n]) => (
                <div key={label as string} className="rounded-xl border border-border bg-surface-2/50 p-3">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="mt-1 text-xl font-semibold">
                    <Counter to={n as number} />
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-border bg-surface-2/40 p-4">
              <p className="text-xs text-muted-foreground">Hiring funnel</p>
              <div className="mt-3 space-y-2.5">
                <ScoreBar label="Applied" value={100} />
                <ScoreBar label="AI screened" value={74} tone="cyan" />
                <ScoreBar label="Voice interview" value={53} />
                <ScoreBar label="Shortlisted" value={17} tone="violet" />
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[
                ["Sarah Johnson", "Senior Frontend Engineer", 92],
                ["Alex Morgan", "Backend Engineer", 89],
              ].map(([name, role, score]) => (
                <div key={name as string} className="rounded-xl border border-border bg-surface-2/50 p-3">
                  <p className="truncate text-sm font-semibold">{name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{role}</p>
                  <p className="mt-2 font-mono text-lg text-cyan">{score}%</p>
                </div>
              ))}
            </div>
            <Waveform className="mt-3 h-10 opacity-80" bars={48} />
          </Panel>
        </Reveal>
      </div>
    </Section>
  );
}

/* ---------------- AI voice interviews ---------------- */

const voiceFeatures = [
  "Natural AI conversation",
  "Dynamic follow-up questions",
  "Real-time speech recognition",
  "Voice activity detection",
  "Interview state management",
  "Adaptive questioning",
  "Automatic transcription",
  "Interview completion detection",
];

export function VoiceInterviewSection() {
  return (
    <Section id="ai-interviews" className="border-y border-border bg-surface/30">
      <div className="grid gap-14 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <Reveal>
          <Panel className="p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-accent uppercase">
                <Radio className="h-3.5 w-3.5" aria-hidden="true" /> AI interviewer
              </span>
              <span className="flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 font-mono text-[11px] text-success">
                <StatusDot /> Listening
              </span>
            </div>
            <div className="mt-5 grid place-items-center rounded-2xl border border-border bg-background/50 p-6">
              <span className="relative grid h-16 w-16 place-items-center rounded-full border border-primary/40 bg-primary/12 text-primary">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/25" />
                <Mic className="relative h-7 w-7" aria-hidden="true" />
              </span>
              <Waveform className="mt-6 w-full" bars={44} />
            </div>
            <div className="mt-4 rounded-2xl border border-border bg-surface-2/50 p-4">
              <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Question 04</p>
              <p className="mt-2 text-sm leading-relaxed">
                “Can you explain a challenging project you recently worked on?”
              </p>
            </div>
            <div className="mt-3 rounded-2xl border border-border bg-surface-2/50 p-4">
              <p className="flex items-center gap-2 font-mono text-[11px] text-cyan">
                <Speech className="h-3.5 w-3.5" aria-hidden="true" /> Candidate ● Speaking…
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                “We migrated a monolith to event-driven services. The hardest part was
                <span className="text-foreground"> keeping data consistent</span> during dual writes, so we…”
              </p>
            </div>
          </Panel>
        </Reveal>

        <div>
          <SectionHead
            eyebrow="Voice AI"
            title="Interviews That Actually"
            highlight="Feel Human."
            description="Uhired AI conducts natural conversational voice interviews that dynamically adapt to each candidate's responses."
          />
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {voiceFeatures.map((f, i) => (
              <Reveal as="li" key={f} delay={i * 45}>
                <div className="flex items-start gap-3 rounded-xl border border-border bg-surface/50 p-3.5">
                  <AudioLines className="mt-0.5 h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
                  <span className="text-sm text-foreground/90">{f}</span>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

/* ---------------- Interview flow ---------------- */

const steps = [
  { n: "01", title: "Candidate Applies", copy: "Application captured with role context.", Icon: Users },
  { n: "02", title: "AI Screening", copy: "Requirements matched automatically.", Icon: FileSearch },
  { n: "03", title: "Voice Interview", copy: "Conversational AI interview runs.", Icon: Mic },
  { n: "04", title: "AI Evaluation", copy: "Structured scoring per criterion.", Icon: BrainCircuit },
  { n: "05", title: "Recruiter Review", copy: "Human decision with full context.", Icon: ClipboardCheck },
  { n: "06", title: "Shortlist", copy: "Best-fit candidates move forward.", Icon: UserRoundCheck },
];

export function FlowSection() {
  return (
    <Section id="how-it-works">
      <SectionHead
        align="center"
        eyebrow="Interview flow"
        title="From Application to"
        highlight="AI-Powered Decision"
      />
      <div className="relative mt-14">
        <div
          aria-hidden="true"
          className="absolute top-7 right-0 left-0 hidden h-px lg:block"
          style={{ background: "var(--gradient-brand)", opacity: 0.45 }}
        />
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
          {steps.map(({ n, title, copy, Icon }, i) => (
            <Reveal as="li" key={n} delay={i * 80}>
              <div className="relative h-full">
                <span className="relative z-10 grid h-14 w-14 place-items-center rounded-2xl border border-primary/40 bg-background text-primary">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <p className="mt-4 font-mono text-xs text-accent">{n}</p>
                <h3 className="mt-1 text-sm font-semibold">{title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{copy}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </Section>
  );
}

/* ---------------- Dynamic interview engine ---------------- */

export function DynamicInterviewSection() {
  return (
    <Section className="border-y border-border bg-surface/30">
      <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHead
            eyebrow="Dynamic engine"
            title="Every Interview Adapts to the"
            highlight="Candidate."
            description="Uhired AI can dynamically choose follow-up questions based on previous answers, job requirements, interview stages, and evaluation criteria."
          />
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { Icon: GitBranch, label: "Branching logic" },
              { Icon: Layers, label: "Stage awareness" },
              { Icon: ListChecks, label: "Criteria-driven" },
            ].map(({ Icon, label }, i) => (
              <Reveal key={label} delay={i * 60}>
                <Card className="p-4">
                  <Icon className="h-5 w-5 text-violet" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium">{label}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal delay={100}>
          <Panel className="p-6">
            <p className="font-mono text-[11px] tracking-[0.18em] text-accent uppercase">AI decision graph</p>
            <svg viewBox="0 0 420 300" className="mt-4 w-full" role="img" aria-label="AI question decision tree">
              <defs>
                <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="oklch(0.82 0.14 197)" />
                  <stop offset="100%" stopColor="oklch(0.63 0.2 296)" />
                </linearGradient>
              </defs>
              {[
                "M210 42 L210 82",
                "M210 114 L210 152",
                "M210 184 L118 224",
                "M210 184 L302 224",
              ].map((d) => (
                <path
                  key={d}
                  d={d}
                  stroke="url(#edge)"
                  strokeWidth="1.5"
                  strokeDasharray="6 8"
                  className="animate-dash"
                  fill="none"
                />
              ))}
              {[
                { x: 210, y: 26, label: "Question 1" },
                { x: 210, y: 98, label: "Candidate Answer" },
                { x: 210, y: 168, label: "AI Analysis" },
                { x: 110, y: 240, label: "Advanced Question" },
                { x: 310, y: 240, label: "Clarifying Question" },
              ].map((n) => (
                <g key={n.label}>
                  <rect
                    x={n.x - 88}
                    y={n.y - 16}
                    width="176"
                    height="32"
                    rx="10"
                    fill="oklch(0.246 0.036 264)"
                    stroke="oklch(0.62 0.212 259 / 0.5)"
                  />
                  <text
                    x={n.x}
                    y={n.y + 5}
                    textAnchor="middle"
                    fontSize="12"
                    fill="oklch(0.97 0.008 250)"
                    fontFamily="var(--font-sans)"
                  >
                    {n.label}
                  </text>
                </g>
              ))}
              <text x="150" y="212" fontSize="10" fill="oklch(0.76 0.16 158)">
                STRONG
              </text>
              <text x="252" y="212" fontSize="10" fill="oklch(0.82 0.15 78)">
                NEEDS DEPTH
              </text>
            </svg>
          </Panel>
        </Reveal>
      </div>
    </Section>
  );
}

/* ---------------- Voice AI technology pipeline ---------------- */

const pipeline = [
  "Candidate Voice",
  "Speech-to-Text",
  "Conversation Engine",
  "Interview State",
  "AI Evaluation",
  "Text-to-Speech",
  "AI Voice",
];

const techCats = [
  "Speech Recognition",
  "Large Language Models",
  "Natural Language Processing",
  "Text-to-Speech",
  "Voice Activity Detection",
  "Real-time Streaming",
  "AI Evaluation",
];

export function VoiceAITechnology() {
  return (
    <Section>
      <SectionHead
        align="center"
        eyebrow="Technology"
        title="Powered by Next-Generation"
        highlight="Voice AI."
        description="Uhired AI combines speech recognition, conversational intelligence, and natural voice synthesis to create responsive AI interviews."
      />
      <Reveal delay={80}>
        <Panel className="mt-12 p-6 sm:p-8">
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {pipeline.map((p, i) => (
              <li key={p} className="relative">
                <div className="glow-card glass h-full rounded-xl p-4 text-center">
                  <p className="font-mono text-[10px] text-accent">{String(i + 1).padStart(2, "0")}</p>
                  <p className="mt-2 text-xs leading-snug font-medium">{p}</p>
                </div>
                {i < pipeline.length - 1 ? (
                  <ArrowRight
                    aria-hidden="true"
                    className="absolute top-1/2 -right-2.5 hidden h-4 w-4 -translate-y-1/2 text-primary/70 lg:block"
                  />
                ) : null}
              </li>
            ))}
          </ol>
          <div className="mt-8 flex items-center gap-4 rounded-xl border border-border bg-surface-2/40 p-4">
            <Volume2 className="h-5 w-5 shrink-0 text-cyan" aria-hidden="true" />
            <Waveform className="h-10 flex-1" bars={56} />
          </div>
          <ul className="mt-8 flex flex-wrap justify-center gap-2">
            {techCats.map((t) => (
              <li
                key={t}
                className="rounded-full border border-border bg-surface/60 px-3.5 py-1.5 text-xs text-muted-foreground"
              >
                {t}
              </li>
            ))}
          </ul>
        </Panel>
      </Reveal>
    </Section>
  );
}

export { Eyebrow };