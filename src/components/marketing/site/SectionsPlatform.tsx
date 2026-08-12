import {
  Briefcase,
  Camera,
  Filter,
  Headphones,
  LineChart,
  MessageSquare,
  Mic,
  Sparkles,
  Timer,
  Users2,
  Wand2,
  Wifi,
} from "lucide-react";
import { Card, Counter, Panel, Reveal, ScoreBar, Section, SectionHead, StatusDot, Waveform } from "./shared";

/* ---------------- Recruiter dashboard ---------------- */

const rows = [
  ["Sarah Johnson", "Senior Frontend Engineer", "Completed", 92, "Strong match"],
  ["Alex Morgan", "Senior Software Engineer", "Completed", 89, "Strong match"],
  ["Priya Nair", "Data Scientist", "In review", 81, "Good match"],
  ["Daniel Mehta", "Frontend Engineer", "Completed", 68, "Moderate match"],
  ["Omar Haddad", "Sales Manager", "Scheduled", 0, "Awaiting interview"],
];

export function RecruiterDashboard() {
  return (
    <Section id="for-recruiters">
      <SectionHead
        align="center"
        eyebrow="For recruiters"
        title="One Dashboard."
        highlight="Every Candidate."
      />
      <Reveal delay={80}>
        <Panel className="mt-12 p-5 sm:p-7">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total candidates", 248, ""],
              ["Interviews completed", 132, ""],
              ["Shortlisted", 42, ""],
              ["Average AI score", 84, "%"],
            ].map(([label, n, suffix]) => (
              <div key={label as string} className="rounded-xl border border-border bg-surface-2/50 p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-2 text-3xl font-semibold">
                  <Counter to={n as number} suffix={suffix as string} />
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" aria-hidden="true" /> Filters
            </span>
            {["Job", "Score", "Interview status", "Date", "Recommendation"].map((f) => (
              <span
                key={f}
                className="rounded-lg border border-border bg-surface/60 px-2.5 py-1 text-xs text-muted-foreground"
              >
                {f}
              </span>
            ))}
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Recent candidates and AI scores</caption>
              <thead>
                <tr className="text-[11px] tracking-widest text-muted-foreground uppercase">
                  {["Candidate", "Role", "Status", "AI score", "Recommendation"].map((h) => (
                    <th key={h} scope="col" className="py-3 pr-4 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([name, role, status, score, rec]) => (
                  <tr key={name as string} className="border-t border-border">
                    <td className="py-3.5 pr-4 font-medium">{name}</td>
                    <td className="py-3.5 pr-4 text-muted-foreground">{role}</td>
                    <td className="py-3.5 pr-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2/60 px-2.5 py-1 text-xs text-muted-foreground">
                        <StatusDot tone={status === "Completed" ? "success" : "primary"} />
                        {status}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 font-mono text-cyan">{score ? `${score}%` : "—"}</td>
                    <td className="py-3.5 pr-4 text-muted-foreground">{rec}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Reveal>
    </Section>
  );
}

/* ---------------- Job creation ---------------- */

const fields = [
  ["Job Title", "Senior Software Engineer"],
  ["Required Skills", "React · Node.js · AWS"],
  ["Experience", "5+ years"],
  ["Location", "Remote · India"],
  ["Interview Type", "Technical + Behavioral"],
  ["Interview Duration", "25 minutes"],
];

export function JobCreationSection() {
  return (
    <Section className="border-y border-border bg-surface/30">
      <div className="grid gap-14 lg:grid-cols-[1fr_1.05fr] lg:items-center">
        <div>
          <SectionHead
            eyebrow="Job setup"
            title="Create Smarter"
            highlight="Job Requirements."
            description="Define the role once — Uhired AI builds the interview plan, question set, and evaluation criteria around it."
          />
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              { Icon: Wand2, label: "Generate interview plan with AI" },
              { Icon: Briefcase, label: "Reusable role templates" },
            ].map(({ Icon, label }, i) => (
              <Reveal key={label} delay={i * 70}>
                <Card className="p-4">
                  <Icon className="h-5 w-5 text-cyan" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium">{label}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal delay={100}>
          <Panel className="p-6">
            <p className="font-mono text-[11px] tracking-[0.18em] text-accent uppercase">New AI interview</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {fields.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-surface-2/50 px-3.5 py-3">
                  <p className="text-[10px] tracking-widest text-muted-foreground uppercase">{label}</p>
                  <p className="mt-1 truncate text-sm">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-border bg-surface-2/50 px-3.5 py-3">
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase">Description</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Own frontend architecture, mentor engineers, and partner with product on delivery.
              </p>
            </div>
            <div className="mt-3 rounded-xl border border-border bg-surface-2/50 px-3.5 py-3">
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase">Evaluation criteria</p>
              <div className="mt-3 space-y-2.5">
                <ScoreBar label="Technical depth (weight)" value={40} />
                <ScoreBar label="Problem solving (weight)" value={30} tone="cyan" />
                <ScoreBar label="Communication (weight)" value={30} tone="violet" />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-primary/45 bg-primary/12 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-primary/20"
              >
                <Sparkles className="h-4 w-4 text-cyan" aria-hidden="true" /> Generate Interview Plan with AI
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                style={{ background: "var(--gradient-brand)" }}
              >
                Create AI Interview
              </button>
            </div>
          </Panel>
        </Reveal>
      </div>
    </Section>
  );
}

/* ---------------- Candidate experience ---------------- */

const states = ["AI is listening…", "AI is speaking…", "Your turn…", "Processing your response…"];

export function CandidateExperience() {
  return (
    <Section id="for-candidates">
      <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <Panel className="p-5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-accent uppercase">
                <StatusDot /> Interview session
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                <Timer className="h-3.5 w-3.5" aria-hidden="true" /> 12:04
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="grid h-40 place-items-center rounded-2xl border border-border bg-surface-2/40">
                <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
                  <Camera className="h-6 w-6 text-primary" aria-hidden="true" />
                  Camera preview
                </div>
              </div>
              <ul className="grid content-start gap-2 text-xs">
                {[
                  { Icon: Mic, label: "Microphone", value: "Connected" },
                  { Icon: Camera, label: "Camera", value: "Connected" },
                  { Icon: Wifi, label: "Network", value: "Excellent" },
                  { Icon: Headphones, label: "Audio", value: "Clear" },
                ].map(({ Icon, label, value }) => (
                  <li
                    key={label}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2/40 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
                    </span>
                    <span className="font-mono text-success">{value}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-3 rounded-2xl border border-border bg-surface-2/50 p-4">
              <p className="font-mono text-[11px] text-primary">AI Interviewer</p>
              <p className="mt-1.5 text-sm">“What part of your last project are you most proud of?”</p>
              <Waveform className="mt-3 h-9" bars={36} />
            </div>
            <div className="mt-3">
              <ScoreBar label="Interview progress" value={67} tone="cyan" />
            </div>
            <ul className="mt-4 flex flex-wrap gap-2">
              {states.map((s) => (
                <li
                  key={s}
                  className="flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-[11px] text-muted-foreground"
                >
                  <StatusDot tone="primary" /> {s}
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>

        <div>
          <SectionHead
            eyebrow="For candidates"
            title="Designed for"
            highlight="Candidates, Too."
            description="A calm, guided interview experience: clear device checks, transparent AI states, live transcript, and visible progress at all times."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              { Icon: MessageSquare, title: "Transparent states", copy: "Candidates always know when the AI is listening, speaking, or processing." },
              { Icon: Users2, title: "No scheduling friction", copy: "Interviews run on the candidate's time, in any timezone." },
              { Icon: LineChart, title: "Visible progress", copy: "Question counters and progress bars reduce interview anxiety." },
              { Icon: Headphones, title: "Device readiness", copy: "Microphone, camera, and network checks before the session begins." },
            ].map(({ Icon, title, copy }, i) => (
              <Reveal key={title} delay={i * 70}>
                <Card className="h-full">
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <h3 className="mt-4 text-sm font-semibold">{title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{copy}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ---------------- Live interview status ---------------- */

export function LiveStatusSection() {
  const items = [
    ["AI status", "Listening"],
    ["Candidate", "Speaking"],
    ["Microphone", "Connected"],
    ["Camera", "Connected"],
    ["Network", "Excellent"],
    ["AI processing", "Active"],
  ];
  return (
    <Section tight className="border-y border-border bg-surface/30">
      <Reveal>
        <Panel className="p-6 sm:p-8">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <h2 className="flex min-w-0 items-center gap-3 text-lg font-semibold">
              <StatusDot /> <span className="truncate">Interview live</span>
            </h2>
            <span className="shrink-0 font-mono text-sm text-cyan">67%</span>
          </div>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full w-[67%] rounded-full" style={{ background: "var(--gradient-brand)" }} />
          </div>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/50 px-4 py-3"
              >
                <dt className="text-xs tracking-widest text-muted-foreground uppercase">{k}</dt>
                <dd className="flex items-center gap-2 font-mono text-sm">
                  <StatusDot /> {v}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      </Reveal>
    </Section>
  );
}

/* ---------------- Interview types + roles ---------------- */

const types = [
  ["HR Screening", "Role interest, availability, and expectations.", "Structured intake questions"],
  ["Technical Interview", "Depth on stack, architecture, and trade-offs.", "Adaptive technical probing"],
  ["Behavioral Interview", "Past situations, ownership, and collaboration.", "STAR-aware follow-ups"],
  ["Communication Assessment", "Clarity, structure, and articulation.", "Speech + language analysis"],
  ["Role-Specific Interview", "Custom questions per job requirement.", "Criteria-weighted scoring"],
  ["Initial Screening", "High-volume first-pass qualification.", "Bulk automated interviews"],
];

const roles = [
  "Software Engineer",
  "Data Scientist",
  "HR Executive",
  "Sales Manager",
  "Customer Support",
  "Marketing Manager",
  "Finance",
  "Operations",
];

export function InterviewTypesSection() {
  return (
    <Section>
      <SectionHead
        align="center"
        eyebrow="Interview types"
        title="Built for Every Stage of"
        highlight="Hiring."
      />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {types.map(([title, copy, cap], i) => (
          <Reveal key={title} delay={i * 60}>
            <Card className="h-full">
              <Mic className="h-5 w-5 text-cyan" aria-hidden="true" />
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy}</p>
              <p className="mt-4 font-mono text-[11px] text-accent">{cap}</p>
            </Card>
          </Reveal>
        ))}
      </div>

      <div className="mt-16">
        <SectionHead align="center" eyebrow="Multi-role support" title="One Platform." highlight="Every Role." />
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {roles.map((r, i) => (
            <Reveal as="li" key={r} delay={i * 45}>
              <div className="glass glow-card flex items-center gap-3 rounded-xl px-4 py-3.5">
                <Briefcase className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate text-sm">{r}</span>
              </div>
            </Reveal>
          ))}
        </ul>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Customize interview questions and evaluation criteria for every role.
        </p>
      </div>
    </Section>
  );
}