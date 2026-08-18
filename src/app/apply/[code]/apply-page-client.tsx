"use client";

import { ArrowRight, Building2, Clock, Loader2, Mail, User } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

type ApplyPreview = {
  valid?: boolean;
  companyName?: string;
  brandColor?: string | null;
  logoUrl?: string | null;
  roleTitle?: string;
  durationMin?: number;
  jobDescription?: string | null;
  error?: string;
};

export function ApplyPageClient({ code }: { code: string }) {
  const [preview, setPreview] = useState<ApplyPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ status: "applied" | "scheduled" } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingPreview(true);
    void (async () => {
      try {
        const response = await fetch(`/api/apply/${encodeURIComponent(code)}`);
        const data = (await response.json()) as ApplyPreview;
        if (!cancelled) setPreview(data);
      } catch {
        if (!cancelled) setPreview({ valid: false, error: "Unable to load this opening." });
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/apply/${encodeURIComponent(code)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: String(form.get("candidateName") ?? "").trim(),
          email: String(form.get("email") ?? "").trim(),
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        status?: "applied" | "scheduled";
        error?: string;
      };
      if (!response.ok || !data.ok) {
        setError(data.error ?? "Unable to submit. Check your details and try again.");
        return;
      }
      setDone({ status: data.status === "scheduled" ? "scheduled" : "applied" });
    } catch {
      setError("Unable to reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const accent = preview?.brandColor?.trim() || null;
  const invalid = !loadingPreview && preview && preview.valid === false;

  return (
    <div
      className="candidate-entry relative flex min-h-screen flex-col overflow-hidden text-[#0f172a]"
      style={
        accent
          ? ({ ["--candidate-accent" as string]: accent } as React.CSSProperties)
          : undefined
      }
    >
      <header className="relative z-20 border-b border-[#1d3557]/8 bg-white/70 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link href="/" className="font-display text-lg font-extrabold tracking-tight no-underline">
            <span className="text-[#0f172a]">Uhired</span>
            <span className="text-gradient"> AI</span>
          </Link>
          {preview?.companyName ? (
            <span className="max-w-[50%] truncate text-sm font-semibold text-[#334155]">
              {preview.companyName}
            </span>
          ) : null}
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-8">
        {loadingPreview ? (
          <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading opening…
          </p>
        ) : invalid ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
            {preview?.error ?? "This apply link is no longer active."}
          </div>
        ) : done ? (
          <section className="rounded-2xl border border-[#1d3557]/10 bg-white p-6 shadow-sm">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748b]">
              You&apos;re registered
            </p>
            <h1 className="font-display mt-2 text-2xl font-extrabold tracking-tight">
              {preview?.roleTitle}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#475569]">
              {done.status === "scheduled"
                ? "Your interview is already scheduled. Check your email for the time and personal link. That link opens only at the scheduled time."
                : "The recruiter will email you a personal interview link with the date and time. You can open that link only at the scheduled time."}
            </p>
          </section>
        ) : (
          <section className="space-y-4">
            <div className="rounded-2xl border border-[#1d3557]/10 bg-white/90 p-5 shadow-sm">
              <div className="flex items-start gap-3">
                {preview?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview.logoUrl} alt="" className="size-12 rounded-xl object-contain ring-1 ring-[#1d3557]/10" />
                ) : (
                  <div className="flex size-12 items-center justify-center rounded-xl bg-[#0f172a]/5">
                    <Building2 className="size-5 text-[#1d3557]" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748b]">
                    Interview invitation
                  </p>
                  <h1 className="font-display mt-1 text-xl font-extrabold tracking-tight">
                    {preview?.roleTitle}
                  </h1>
                  {preview?.companyName ? (
                    <p className="text-sm text-[#475569]">at {preview.companyName}</p>
                  ) : null}
                  {preview?.durationMin ? (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-[#475569]">
                      <Clock className="size-3.5 text-[color:var(--candidate-accent,#0e7490)]" />
                      {preview.durationMin} min AI interview
                    </p>
                  ) : null}
                </div>
              </div>
              {preview?.jobDescription ? (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[#334155]">
                  {preview.jobDescription}
                </p>
              ) : null}
            </div>

            <form
              onSubmit={(event) => void handleSubmit(event)}
              className="rounded-2xl border border-[#1d3557]/10 bg-white p-5 shadow-sm"
            >
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#64748b]">
                Apply with your details
              </p>
              <div className="relative mt-3">
                <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
                <input
                  name="candidateName"
                  required
                  minLength={2}
                  placeholder="Full name"
                  autoComplete="name"
                  className="w-full rounded-xl border border-[#1d3557]/12 bg-[#f8fafc] py-3 pr-3 pl-10 text-sm outline-none focus:border-[color:var(--candidate-accent,#0e7490)] focus:bg-white"
                />
              </div>
              <div className="relative mt-2">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="Email"
                  autoComplete="email"
                  className="w-full rounded-xl border border-[#1d3557]/12 bg-[#f8fafc] py-3 pr-3 pl-10 text-sm outline-none focus:border-[color:var(--candidate-accent,#0e7490)] focus:bg-white"
                />
              </div>
              {error ? (
                <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={submitting}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60"
                style={{
                  background:
                    "linear-gradient(105deg, color-mix(in oklab, var(--candidate-accent, #0e7490) 75%, #1d3557), #1d3557 70%)",
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    Submit application
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
              <p className="mt-3 text-xs leading-relaxed text-[#64748b]">
                Recruiter will see your name and email on this opening, then email you a time and
                personal interview link.
              </p>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
