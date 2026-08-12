"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, Lock, Mic, ShieldCheck, type LucideIcon } from "lucide-react";
import { Logo } from "./Navbar";
import { Orb, Waveform } from "./shared";

const defaultHighlights = [
  { Icon: Mic, title: "Conversational voice interviews", copy: "Natural AI-led screening at any scale." },
  { Icon: BarChart3, title: "Structured AI evaluation", copy: "Consistent scorecards for every candidate." },
  { Icon: ShieldCheck, title: "Enterprise-grade security", copy: "Encrypted data, isolated workspaces." },
];

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  highlights = defaultHighlights,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
  highlights?: Array<{ Icon: LucideIcon; title: string; copy: string }>;
}) {
  return (
    <div className="relative grid min-h-screen overflow-hidden bg-background lg:grid-cols-[1.05fr_1fr]">
      <Orb className="-top-32 -left-24 h-[420px] w-[420px] opacity-35" />
      <Orb className="-bottom-40 left-1/4 h-[380px] w-[380px] opacity-25" tone="violet" />

      <div className="relative z-10 flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground no-underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to home
          </Link>
        </div>

        <div className="animate-rise mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 font-mono text-[11px] tracking-[0.2em] text-accent uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {eyebrow}
          </span>
          <h1 className="mt-5 text-3xl leading-tight font-semibold sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-8 text-sm text-muted-foreground">{footer}</div>
          <p className="mt-6 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <Lock className="h-3.5 w-3.5 text-success" aria-hidden="true" /> Protected by end-to-end encryption
          </p>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-border lg:block">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-primary/15 via-surface-2 to-violet/20"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/60 to-background/95" />
        <div aria-hidden="true" className="neural-grid animate-grid-pan absolute inset-0 opacity-70" />
        <div className="relative z-10 flex h-full flex-col justify-center gap-6 p-12">
          <div className="glass animate-zoom-in rounded-2xl p-6" style={{ boxShadow: "var(--shadow-panel)" }}>
            <p className="font-mono text-[11px] tracking-[0.2em] text-accent uppercase">Live voice session</p>
            <Waveform className="mt-4 h-14" bars={36} />
            <p className="mt-4 text-sm text-muted-foreground">
              “Walk me through a project where you owned the outcome end to end.”
            </p>
          </div>
          <ul className="grid gap-4">
            {highlights.map(({ Icon, title: t, copy }, i) => (
              <li
                key={t}
                className="glass glow-card animate-rise-right flex items-start gap-4 rounded-2xl p-5"
                style={{ animationDelay: `${140 + i * 110}ms` }}
              >
                <span className="inline-grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/40 bg-primary/12 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{t}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

export function Field({
  label,
  className,
  ...props
}: { label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-xs font-medium tracking-wide text-muted-foreground">{label}</span>
      <input
        {...props}
        className={`mt-2 w-full rounded-xl border border-border bg-surface/60 px-4 py-3 text-sm text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-surface focus:ring-4 focus:ring-primary/15 ${className ?? ""}`}
      />
    </label>
  );
}

export function TextareaField({
  label,
  className,
  ...props
}: { label: string; className?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <span className="text-xs font-medium tracking-wide text-muted-foreground">{label}</span>
      <textarea
        {...props}
        className={`mt-2 w-full resize-y rounded-xl border border-border bg-surface/60 px-4 py-3 text-sm text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-surface focus:ring-4 focus:ring-primary/15 ${className ?? ""}`}
      />
    </label>
  );
}
