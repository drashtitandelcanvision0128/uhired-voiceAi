"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { MarketingBackground } from "@/components/marketing/site/marketing-page-shell";

type PortalSession = {
  id: string;
  sessionType: string;
  status: string;
  domain: string;
  topic: string;
  positionTitle: string | null;
  companyName: string | null;
  durationMin: number;
  endedAt?: string | null;
  scorecard?: { overallScore: number; summary: string | null } | null;
};

type PortalData = {
  email: string;
  inProgress: PortalSession[];
  completed: PortalSession[];
  stats: {
    totalCompleted: number;
    practiceCount: number;
    companyCount: number;
    avgScore: number | null;
  };
};

export default function CandidateHistoryPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code" | "dashboard">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<PortalData | null>(null);

  const loadSessions = useCallback(async () => {
    const response = await fetch("/api/candidate-portal/sessions", { cache: "no-store" });
    if (!response.ok) {
      setStep("email");
      setData(null);
      return;
    }
    const json = (await response.json()) as PortalData;
    setData(json);
    setStep("dashboard");
  }, []);

  useEffect(() => {
    void (async () => {
      const authRes = await fetch("/api/candidate-portal/auth", { cache: "no-store" });
      const authJson = (await authRes.json()) as { authenticated?: boolean; email?: string };
      if (authJson.authenticated && authJson.email) {
        setEmail(authJson.email);
        await loadSessions();
      }
    })();
  }, [loadSessions]);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/candidate-portal/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(json.error ?? "Unable to send code.");
        return;
      }
      setStep("code");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/candidate-portal/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(json.error ?? "Invalid code.");
        return;
      }
      await loadSessions();
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/candidate-portal/auth", { method: "DELETE" });
    setData(null);
    setStep("email");
    setCode("");
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground">
      <MarketingBackground />
      <SiteHeader />
      <main className="flex-1 container max-w-3xl mx-auto px-4 py-12 md:px-8">
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">My interview history</h1>
        <p className="text-muted-foreground mb-8">
          View past practice and company interviews linked to your email.
        </p>

        {error ? (
          <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {step === "email" ? (
          <form onSubmit={requestCode} className="space-y-4 max-w-md">
            <label className="block text-sm font-medium">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm"
                placeholder="you@company.com"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send login code"}
            </button>
          </form>
        ) : null}

        {step === "code" ? (
          <form onSubmit={verifyCode} className="space-y-4 max-w-md">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code sent to <strong>{email}</strong>.
            </p>
            <label className="block text-sm font-medium">
              Code
              <input
                type="text"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="mt-1 w-full rounded-lg border border-border bg-background px-4 py-3 text-sm tracking-widest"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Verifying…" : "View history"}
            </button>
          </form>
        ) : null}

        {step === "dashboard" && data ? (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">Signed in as {data.email}</p>
              <button
                type="button"
                onClick={() => void logout()}
                className="text-sm font-medium text-primary"
              >
                Sign out
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border p-4 bg-card">
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{data.stats.totalCompleted}</p>
              </div>
              <div className="rounded-xl border border-border p-4 bg-card">
                <p className="text-xs text-muted-foreground">Practice</p>
                <p className="text-2xl font-bold">{data.stats.practiceCount}</p>
              </div>
              <div className="rounded-xl border border-border p-4 bg-card">
                <p className="text-xs text-muted-foreground">Avg score</p>
                <p className="text-2xl font-bold">{data.stats.avgScore ?? "—"}</p>
              </div>
            </div>

            {data.inProgress.length > 0 ? (
              <section>
                <h2 className="font-bold text-lg mb-3">In progress</h2>
                <ul className="space-y-3">
                  {data.inProgress.map((s) => (
                    <li key={s.id} className="rounded-xl border border-border p-4 bg-card flex justify-between gap-4">
                      <div>
                        <p className="font-semibold">{s.positionTitle ?? s.domain}</p>
                        <p className="text-sm text-muted-foreground">{s.companyName ?? "Practice"} · {s.status}</p>
                      </div>
                      <Link href={`/interview/${s.id}`} className="text-sm font-semibold text-primary no-underline">
                        Continue →
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <h2 className="font-bold text-lg mb-3">Completed interviews</h2>
              {data.completed.length === 0 ? (
                <p className="text-muted-foreground text-sm">No completed interviews yet.</p>
              ) : (
                <ul className="space-y-3">
                  {data.completed.map((s) => (
                    <li key={s.id} className="rounded-xl border border-border p-4 bg-card">
                      <div className="flex justify-between gap-2 mb-1">
                        <p className="font-semibold">{s.positionTitle ?? s.topic}</p>
                        <span className="text-sm font-bold text-primary">
                          {s.scorecard?.overallScore ?? "—"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {s.sessionType} · {s.companyName ?? "Practice"}
                        {s.endedAt ? ` · ${new Date(s.endedAt).toLocaleDateString()}` : ""}
                      </p>
                      {s.scorecard?.summary ? (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{s.scorecard.summary}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
