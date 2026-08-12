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
  Zap,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type InvitePreview = {
  valid: boolean;
  expired?: boolean;
  companyName?: string | null;
  brandColor?: string | null;
  logoUrl?: string | null;
  roleTitle?: string;
  durationMin?: number;
  expiresAt?: string | null;
  emailHint?: string | null;
  error?: string | null;
};

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
      className="candidate-entry relative flex min-h-screen flex-col overflow-hidden text-[#0f172a]"
      style={
        accent
          ? ({
              ["--candidate-accent" as string]: accent,
            } as React.CSSProperties)
          : undefined
      }
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="candidate-entry-mesh absolute inset-0" />
        <div className="absolute -left-24 top-[-10%] h-[28rem] w-[28rem] rounded-full bg-[color-mix(in_oklab,var(--candidate-accent,#0e7490)_18%,transparent)] blur-3xl" />
        <div className="absolute -right-20 bottom-[-5%] h-[26rem] w-[26rem] rounded-full bg-[color-mix(in_oklab,#1d3557_14%,transparent)] blur-3xl" />
        <div className="candidate-entry-grid absolute inset-0 opacity-[0.35]" />
      </div>

      <header className="relative z-20 border-b border-[#1d3557]/8 bg-white/70 backdrop-blur-xl">
        <nav className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="font-display text-xl font-extrabold tracking-tight no-underline">
            <span className="text-[#0f172a]">Uhired</span>
            <span className="text-gradient"> AI</span>
          </Link>
          {preview?.companyName ? (
            <span className="max-w-[50%] truncate text-sm font-semibold text-[#334155]">
              {preview.companyName}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1d3557]/10 bg-white/80 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#475569]">
              <Lock className="h-3 w-3 text-[color:var(--candidate-accent,#0e7490)]" />
              Secure access
            </span>
          )}
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 py-10 sm:px-8 lg:py-14">
        <div className="grid flex-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
          {/* Left copy */}
          <section className="animate-rise space-y-7 lg:col-span-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--candidate-accent,#0e7490)_28%,transparent)] bg-[color-mix(in_oklab,var(--candidate-accent,#0e7490)_10%,white)] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--candidate-accent,#0f766e)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--candidate-accent,#0e7490)]" />
              Interview room access
            </span>

            {preview?.valid && preview.roleTitle ? (
              <div className="candidate-invite-card rounded-2xl border border-[#1d3557]/10 bg-white/85 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] backdrop-blur-md sm:p-6">
                <div className="flex items-start gap-4">
                  {preview.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={preview.logoUrl}
                      alt=""
                      className="h-12 w-12 rounded-xl object-contain ring-1 ring-[#1d3557]/10"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--candidate-accent,#1d3557)_12%,white)] text-[#1d3557]">
                      <Building2 className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748b]">
                      Interview invitation
                    </p>
                    <h2 className="font-display mt-1 text-xl font-extrabold tracking-tight text-[#0f172a] sm:text-2xl">
                      {preview.roleTitle}
                    </h2>
                    {preview.companyName ? (
                      <p className="mt-0.5 text-sm font-medium text-[#475569]">at {preview.companyName}</p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#475569]">
                      {preview.durationMin ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-[color:var(--candidate-accent,#0e7490)]" />
                          {preview.durationMin} min
                        </span>
                      ) : null}
                      {preview.emailHint ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-[color:var(--candidate-accent,#0e7490)]" />
                          {preview.emailHint}
                        </span>
                      ) : null}
                      {preview.expiresAt ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-[color:var(--candidate-accent,#0e7490)]" />
                          Until {new Date(preview.expiresAt).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div>
              <h1 className="font-display text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-[#0f172a] sm:text-5xl lg:text-[3.35rem]">
                Your next chapter
                <span className="mt-1 block text-[color:var(--candidate-accent,#0e7490)]">starts here.</span>
              </h1>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-[#475569] sm:text-lg">
                {preview?.valid
                  ? "Confirm your details to enter the interview room. Use the same email address that received the invite."
                  : "Enter the interview code from your invite email, then confirm your name and email to continue."}
              </p>
            </div>

            {previewLoading ? (
              <p className="inline-flex items-center gap-2 text-sm font-medium text-[#64748b]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading interview details…
              </p>
            ) : preview?.error && !preview.valid ? (
              <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
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
                  className="flex items-center gap-2.5 rounded-xl border border-[#1d3557]/8 bg-white/60 px-3 py-2.5 text-xs font-semibold text-[#334155] backdrop-blur-sm"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0f172a]/5 text-[#1d3557]">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </section>

          {/* Form */}
          <section className="animate-rise-right lg:col-span-6" style={{ animationDelay: "80ms" }}>
            <form
              onSubmit={handleSubmit}
              className="candidate-entry-form relative overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/90 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.1)] backdrop-blur-xl sm:p-8"
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-1"
                style={{
                  background:
                    "linear-gradient(90deg, color-mix(in oklab, var(--candidate-accent, #0e7490) 80%, #1d3557), #1d3557)",
                }}
              />

              <div className="space-y-2">
                <label
                  htmlFor="accessCode"
                  className="block font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#64748b]"
                >
                  Interview session code
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
                  <input
                    id="accessCode"
                    name="accessCode"
                    required
                    defaultValue={initialCode}
                    placeholder="Paste your invite code"
                    autoComplete="off"
                    className="w-full rounded-xl border border-[#1d3557]/12 bg-[#f8fafc] py-3.5 pl-11 pr-4 font-mono text-sm font-semibold tracking-wide text-[#0f172a] outline-none transition placeholder:font-sans placeholder:font-medium placeholder:tracking-normal placeholder:text-[#94a3b8] focus:border-[color:var(--candidate-accent,#0e7490)] focus:bg-white focus:ring-4 focus:ring-[color-mix(in_oklab,var(--candidate-accent,#0e7490)_18%,transparent)]"
                  />
                </div>
              </div>

              <div className="mt-7 space-y-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#64748b]">
                  Your details
                </p>
                <input
                  name="candidateName"
                  required
                  placeholder="Full name"
                  autoComplete="name"
                  className="w-full rounded-xl border border-[#1d3557]/12 bg-[#f8fafc] px-4 py-3.5 text-sm font-medium text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] focus:border-[color:var(--candidate-accent,#0e7490)] focus:bg-white focus:ring-4 focus:ring-[color-mix(in_oklab,var(--candidate-accent,#0e7490)_18%,transparent)]"
                />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="Email used for the invite"
                  autoComplete="email"
                  className="w-full rounded-xl border border-[#1d3557]/12 bg-[#f8fafc] px-4 py-3.5 text-sm font-medium text-[#0f172a] outline-none transition placeholder:text-[#94a3b8] focus:border-[color:var(--candidate-accent,#0e7490)] focus:bg-white focus:ring-4 focus:ring-[color-mix(in_oklab,var(--candidate-accent,#0e7490)_18%,transparent)]"
                />
              </div>

              {error ? (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading || preview?.valid === false}
                className="group mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(29,53,87,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(29,53,87,0.34)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background:
                    "linear-gradient(105deg, color-mix(in oklab, var(--candidate-accent, #0e7490) 75%, #1d3557), #1d3557 70%)",
                }}
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

              <div className="mt-5 flex items-start gap-3 rounded-xl border border-[color-mix(in_oklab,var(--candidate-accent,#0e7490)_18%,transparent)] bg-[color-mix(in_oklab,var(--candidate-accent,#0e7490)_8%,white)] px-4 py-3.5">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--candidate-accent,#0e7490)]" />
                <p className="text-xs leading-relaxed text-[#334155]">
                  <span className="font-bold text-[#0f172a]">Before you begin:</span> camera and microphone
                  checks run inside the interview room.
                </p>
              </div>
            </form>
          </section>
        </div>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[#1d3557]/8 pt-6 text-xs text-[#64748b]">
          <p>© {new Date().getFullYear()} Uhired. All rights reserved.</p>
          <div className="flex gap-4 font-semibold">
            <Link href="/privacy" className="transition hover:text-[#0f172a]">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-[#0f172a]">
              Terms
            </Link>
            <Link href="/contact" className="transition hover:text-[#0f172a]">
              Support
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
