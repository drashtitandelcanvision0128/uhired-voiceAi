"use client";

import {
  ArrowRight,
  Building2,
  Calendar,
  Clock,
  Headphones,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Video,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/marketing/site/Navbar";
import { Orb } from "@/components/marketing/site/shared";

type InvitePreview = {
  valid: boolean;
  expired?: boolean;
  companyName?: string | null;
  brandColor?: string | null;
  logoUrl?: string | null;
  roleTitle?: string;
  durationMin?: number;
  scheduledAt?: string | null;
  opensAt?: string | null;
  expiresAt?: string | null;
  emailHint?: string | null;
  error?: string | null;
};

const fieldClass =
  "w-full rounded-xl border border-border bg-surface/60 px-4 py-3.5 text-sm text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/70 focus:border-primary/60 focus:bg-surface focus:ring-4 focus:ring-primary/15";

export default function CandidatePage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [initialCode] = useState(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("code") ?? "";
  });

  useEffect(() => {
    const code = initialCode.trim();
    if (!code) {
      setPreview(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    void (async () => {
      try {
        const response = await fetch(`/api/candidate/preview?code=${encodeURIComponent(code)}`);
        const data = (await response.json()) as InvitePreview;
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialCode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      accessCode: String(formData.get("accessCode") ?? "").trim(),
      candidateName: String(formData.get("candidateName") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
    };

    let data: { sessionId?: string; error?: string };
    try {
      const response = await fetch("/api/candidate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      data = (await response.json()) as { sessionId?: string; error?: string };
      setLoading(false);

      if (!response.ok || !data.sessionId) {
        setError(
          data.error ??
            "We could not verify that interview code. Check the code from your invite email and try again.",
        );
        return;
      }
    } catch {
      setLoading(false);
      setError("Unable to reach the server. Check your connection and try again.");
      return;
    }
    router.push(`/interview/${data.sessionId}`);
  }

  const accent = preview?.brandColor?.trim() || null;

  return (
    <div
      className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground"
      style={
        accent
          ? ({
              ["--candidate-accent" as string]: accent,
            } as React.CSSProperties)
          : undefined
      }
    >
      <Orb className="-top-32 -left-24 h-[420px] w-[420px] opacity-30" />
      <Orb className="-bottom-40 -right-20 h-[380px] w-[380px] opacity-20" tone="violet" />
      <div aria-hidden="true" className="neural-grid animate-grid-pan pointer-events-none absolute inset-0 opacity-50" />

      <header className="relative z-20 border-b border-border bg-background/70 backdrop-blur-xl">
        <nav className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between px-5 sm:px-8">
          <Logo />
          {preview?.companyName ? (
            <span className="max-w-[50%] truncate text-sm font-semibold text-muted-foreground">
              {preview.companyName}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              <Lock className="h-3 w-3 text-primary" />
              Secure access
            </span>
          )}
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8 lg:py-14">
        <div className="grid flex-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
          <section className="animate-rise space-y-7 lg:col-span-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Interview room access
            </span>

            {preview?.roleTitle ? (
              <div className="glass glow-card rounded-2xl border border-border p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  {preview.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={preview.logoUrl}
                      alt=""
                      className="h-12 w-12 rounded-xl object-contain ring-1 ring-border"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/40 bg-primary/12 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Interview invitation
                    </p>
                    <h2 className="font-display mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">
                      {preview.roleTitle}
                    </h2>
                    {preview.companyName ? (
                      <p className="mt-0.5 text-sm font-medium text-muted-foreground">
                        at {preview.companyName}
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      {preview.durationMin ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          {preview.durationMin} min
                        </span>
                      ) : null}
                      {preview.emailHint ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-primary" />
                          {preview.emailHint}
                        </span>
                      ) : null}
                      {preview.scheduledAt ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          {new Date(preview.scheduledAt).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "Asia/Kolkata",
                          })}{" "}
                          IST
                        </span>
                      ) : preview.expiresAt ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          Until {new Date(preview.expiresAt).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div>
              <h1 className="font-display text-[2.6rem] font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.35rem]">
                Your next chapter
                <span className="text-gradient mt-1 block">starts here.</span>
              </h1>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                {preview?.valid
                  ? "Confirm your details to enter the interview room. Use the same email address that received the invite."
                  : preview?.scheduledAt
                    ? "This interview link is locked until the scheduled time. Come back then to start."
                    : "Enter the interview code from your invite email, then confirm your name and email to continue."}
              </p>
            </div>

            {previewLoading ? (
              <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading interview details…
              </p>
            ) : preview?.error && !preview.valid ? (
              <p className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm font-medium text-warning">
                {preview.error}
              </p>
            ) : null}

            <ul className="hidden gap-3 sm:grid sm:grid-cols-3">
              {[
                { icon: Video, label: "Device check" },
                { icon: ShieldCheck, label: "Encrypted" },
                { icon: Headphones, label: "Live support" },
              ].map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="glass flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-foreground"
                >
                  <span className="inline-grid h-8 w-8 place-items-center rounded-lg border border-primary/40 bg-primary/12 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </section>

          <section className="animate-rise-right lg:col-span-6" style={{ animationDelay: "80ms" }}>
            <form
              onSubmit={handleSubmit}
              className="glass glow-card relative overflow-hidden rounded-[1.35rem] border border-border p-6 sm:p-8"
              style={{ boxShadow: "var(--shadow-panel)" }}
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-1"
                style={{ background: "var(--gradient-brand)" }}
              />

              <div className="space-y-2">
                <label
                  htmlFor="accessCode"
                  className="block font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Interview session code
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="accessCode"
                    name="accessCode"
                    required
                    defaultValue={initialCode}
                    placeholder="Paste your invite code"
                    autoComplete="off"
                    className={`${fieldClass} pl-11 font-mono font-semibold tracking-wide`}
                  />
                </div>
              </div>

              <div className="mt-7 space-y-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Your details
                </p>
                <input
                  name="candidateName"
                  required
                  placeholder="Full name"
                  autoComplete="name"
                  className={fieldClass}
                />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="Email used for the invite"
                  autoComplete="email"
                  className={fieldClass}
                />
              </div>

              {error ? (
                <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading || preview?.valid === false}
                className="group mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:-translate-y-0.5 hover:opacity-95 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    Start my interview
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>

              <div className="mt-5 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/8 px-4 py-3.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-bold text-foreground">Security tip:</span> use your personal
                  invite link only. Do not share the interview code on WhatsApp/social — it is
                  single-use and locked to this browser once you start. Keep a stable internet
                  connection for the best scoring accuracy.
                </p>
              </div>
            </form>
          </section>
        </div>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Uhired. All rights reserved.</p>
          <div className="flex gap-4 font-semibold">
            <Link href="/privacy" className="transition hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-foreground">
              Terms
            </Link>
            <Link href="/contact" className="transition hover:text-foreground">
              Support
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
