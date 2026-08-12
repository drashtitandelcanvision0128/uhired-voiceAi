import { AlertCircle, CheckCircle2, FileText, Search, Sparkles, TrendingUp } from "lucide-react";
import { Card, Panel, Reveal, ScoreBar, Section, SectionHead, StatusDot, Waveform } from "./shared";

/* ---------------- Smart screening ---------------- */

const candidates = [
  {
    name: "Sarah Johnson",
    role: "Senior Frontend Engineer",
    score: 92,
    skills: ["React", "TypeScript", "Node.js", "AWS"],
    rec: "Strong technical match",
    tone: "success" as const,
  },
  {
    name: "Daniel Mehta",
    role: "Frontend Engineer",
    score: 68,
    skills: ["React", "JavaScript", "CSS"],
    rec: "Moderate match",
    tone: "warning" as const,
  },
];

export function AIScreeningSection() {
  return (
    <Section className="border-y border-border bg-surface/30">
      <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHead
            eyebrow="Smart screening"
            title="Screen Hundreds of Candidates in"
            highlight="Minutes."
            description="Automatically identify candidates who match your job requirements before your recruiters spend time on interviews."
          />
          <div className="mt-8 flex items-center gap-3 rounded-xl border border-border bg-surface/60 p-4">
            <Search className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Match scores are decision support — recruiters always stay in control of the shortlist.
            </p>
          </div>
        </div>

        <div className="grid gap-4">
          {candidates.map((c, i) => (
            <Reveal key={c.name} delay={i * 100}>
              <Card>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{c.name}</h3>
                    <p className="truncate text-xs text-muted-foreground">{c.role}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-2xl text-cyan">{c.score}%</p>
                    <p className="text-[10px] tracking-widest text-muted-foreground uppercase">Match score</p>
                  </div>
                </div>
                <div className="mt-4">
                  <ScoreBar label="Requirement coverage" value={c.score} tone={c.score > 80 ? "cyan" : "violet"} />
                </div>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {c.skills.map((s) => (
                    <li
                      key={s}
                      className="rounded-md border border-border bg-surface-2/60 px-2.5 py-1 font-mono text-[11px] text-muted-foreground"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 flex items-center gap-2 text-sm">
                  {c.tone === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                  )}
                  <span className="text-muted-foreground">
                    AI recommendation: <span className="text-foreground">{c.rec}</span>
                  </span>
                </p>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ---------------- Evaluation ---------------- */

export function EvaluationSection() {
  return (
    <Section>
      <div className="grid gap-14 lg:grid-cols-[1fr_1.05fr] lg:items-center">
        <div>
          <SectionHead
            eyebrow="Candidate evaluation"
            title="Turn Conversations Into"
            highlight="Candidate Intelligence."
            description="Uhired AI analyzes interview responses against the structured evaluation criteria you define for each role."
          />
          <p className="mt-6 rounded-xl border border-primary/30 bg-primary/8 p-4 text-sm text-muted-foreground">
            Evaluation output is <span className="text-foreground">decision support</span> for your hiring team —
            never an automatic final hiring decision.
          </p>
        </div>

        <Reveal delay={100}>
          <Panel className="p-6">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
              <p className="font-mono text-[11px] tracking-[0.18em] text-accent uppercase">Evaluation summary</p>
              <div className="shrink-0 text-right">
                <p className="font-mono text-3xl text-gradient">91%</p>
                <p className="text-[10px] tracking-widest text-muted-foreground uppercase">Overall score</p>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <ScoreBar label="Technical Skills" value={92} />
              <ScoreBar label="Communication" value={84} tone="cyan" />
              <ScoreBar label="Problem Solving" value={89} />
              <ScoreBar label="Confidence" value={81} tone="violet" />
              <ScoreBar label="Role Fit" value={91} tone="cyan" />
            </div>
            <div className="mt-6 rounded-xl border border-border bg-surface-2/50 p-4">
              <p className="flex items-center gap-2 font-mono text-[11px] text-cyan">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> AI summary
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                “Candidate demonstrates strong technical knowledge, structured problem-solving ability, and clear
                communication.”
              </p>
            </div>
          </Panel>
        </Reveal>
      </div>
    </Section>
  );
}

/* ---------------- Transcription ---------------- */

const transcript = [
  { t: "00:42", who: "AI Interviewer", text: "How do you approach designing a scalable API?", conf: 99 },
  {
    t: "00:51",
    who: "Candidate",
    text: "I start from access patterns, then define contracts and versioning before scaling reads.",
    conf: 97,
    key: true,
  },
  { t: "01:24", who: "AI Interviewer", text: "How did you handle caching and rate limiting?", conf: 98 },
  {
    t: "01:31",
    who: "Candidate",
    text: "We layered edge caching with token-bucket limits per tenant to protect downstream services.",
    conf: 96,
    key: true,
  },
];

export function TranscriptionSection() {
  return (
    <Section className="border-y border-border bg-surface/30">
      <SectionHead
        align="center"
        eyebrow="Transcription"
        title="Every Conversation,"
        highlight="Captured."
        description="Live transcription with speaker separation, timestamps, and confidence indicators — searchable after every interview."
      />
      <Reveal delay={80}>
        <Panel className="mt-12 grid gap-0 overflow-hidden lg:grid-cols-[0.85fr_1.15fr]">
          <div className="flex flex-col justify-center gap-6 border-border p-6 lg:border-r">
            <div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-accent uppercase">
              <StatusDot /> Recording
            </div>
            <Waveform className="h-28" bars={30} />
            <ul className="space-y-2 text-xs text-muted-foreground">
              {["Speaker separation", "Timestamped conversation", "Confidence indicators", "Key answer extraction"].map(
                (f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {f}
                  </li>
                ),
              )}
            </ul>
          </div>
          <div className="bg-background/40 p-6">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">Search transcript…</span>
            </div>
            <ul className="mt-4 space-y-4">
              {transcript.map((r) => (
                <li key={r.t} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                  <span className="font-mono text-[11px] text-muted-foreground">{r.t}</span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className={r.who === "Candidate" ? "text-cyan" : "text-primary"}>{r.who}</span>
                      <span className="font-mono text-muted-foreground">conf {r.conf}%</span>
                    </p>
                    <p
                      className={
                        r.key
                          ? "mt-1 rounded-md border border-primary/25 bg-primary/8 px-2 py-1.5 text-sm text-foreground"
                          : "mt-1 text-sm text-muted-foreground"
                      }
                    >
                      {r.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-5 flex items-start gap-2 rounded-lg border border-border bg-surface-2/40 p-3 text-xs text-muted-foreground">
              <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" aria-hidden="true" />
              Interview summary generated automatically once the session completes.
            </p>
          </div>
        </Panel>
      </Reveal>
    </Section>
  );
}

/* ---------------- Analytics ---------------- */

export function AnalyticsSection() {
  return (
    <Section>
      <div className="grid gap-14 lg:grid-cols-[1fr_1.15fr] lg:items-center">
        <div>
          <SectionHead
            eyebrow="Interview analytics"
            title="Understand More Than Just"
            highlight="Answers."
            description="Speaking balance, response quality, and completion signals for every interview — presented in a readable, professional format."
          />
          <div className="mt-8 grid grid-cols-2 gap-4">
            {[
              ["Interview completion", "100%"],
              ["Avg. response quality", "88%"],
            ].map(([k, v]) => (
              <Card key={k} className="p-5">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="mt-2 font-mono text-2xl text-gradient">{v}</p>
              </Card>
            ))}
          </div>
        </div>

        <Reveal delay={100}>
          <Panel className="p-6">
            <div className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
              <div className="mx-auto">
                <svg viewBox="0 0 120 120" className="h-36 w-36" role="img" aria-label="Speaking time split">
                  <circle cx="60" cy="60" r="48" fill="none" stroke="oklch(0.246 0.036 264)" strokeWidth="14" />
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    fill="none"
                    stroke="oklch(0.62 0.212 259)"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeDasharray="205 302"
                    transform="rotate(-90 60 60)"
                  />
                  <text x="60" y="58" textAnchor="middle" fontSize="18" fill="oklch(0.97 0.008 250)">
                    68%
                  </text>
                  <text x="60" y="76" textAnchor="middle" fontSize="9" fill="oklch(0.7 0.024 258)">
                    CANDIDATE
                  </text>
                </svg>
              </div>
              <div className="space-y-4">
                <ScoreBar label="Candidate speaking time" value={68} />
                <ScoreBar label="AI speaking time" value={32} tone="violet" />
                <ScoreBar label="Technical accuracy" value={91} tone="cyan" />
                <ScoreBar label="Communication" value={85} />
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-border bg-surface-2/40 p-4">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-cyan" aria-hidden="true" /> Response quality over interview
                timeline
              </p>
              <svg viewBox="0 0 320 90" className="mt-3 w-full" role="img" aria-label="Response quality trend">
                <defs>
                  <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.62 0.212 259 / 0.5)" />
                    <stop offset="100%" stopColor="oklch(0.62 0.212 259 / 0)" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 70 L45 58 L90 62 L135 42 L180 46 L225 28 L270 32 L320 18"
                  fill="none"
                  stroke="oklch(0.82 0.14 197)"
                  strokeWidth="2"
                />
                <path
                  d="M0 70 L45 58 L90 62 L135 42 L180 46 L225 28 L270 32 L320 18 L320 90 L0 90 Z"
                  fill="url(#area)"
                />
              </svg>
            </div>
          </Panel>
        </Reveal>
      </div>
    </Section>
  );
}

/* ---------------- Reports ---------------- */

export function ReportSection() {
  return (
    <Section className="border-y border-border bg-surface/30">
      <SectionHead
        align="center"
        eyebrow="AI reports"
        title="From Interview to"
        highlight="Actionable Report."
      />
      <Reveal delay={80}>
        <Panel className="mx-auto mt-12 max-w-4xl p-6 sm:p-8">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b border-border pb-6">
            <div className="min-w-0">
              <h3 className="truncate text-xl font-semibold">Alex Morgan</h3>
              <p className="truncate text-sm text-muted-foreground">Senior Software Engineer</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-3xl text-gradient">89%</p>
              <p className="mt-1 inline-flex rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-[11px] text-success">
                Strong Match
              </p>
            </div>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="font-mono text-[11px] tracking-widest text-accent uppercase">AI summary</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                “Strong technical knowledge with excellent problem-solving ability. Demonstrates clear communication
                and practical experience.”
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="font-mono text-[11px] tracking-widest text-success uppercase">Strengths</p>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {["System design", "Communication", "Problem solving"].map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-mono text-[11px] tracking-widest text-warning uppercase">Areas to explore</p>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  <li>Leadership experience</li>
                </ul>
              </div>
            </div>
          </div>
        </Panel>
      </Reveal>
    </Section>
  );
}