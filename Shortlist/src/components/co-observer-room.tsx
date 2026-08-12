"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, Radio, RefreshCw } from "lucide-react";

type TranscriptTurn = {
  speaker: string;
  message: string;
  orderIndex: number;
  timestampMs: number | null;
};

type ObserveSession = {
  id: string;
  status: string;
  candidateName: string | null;
  domain: string;
  topic: string;
  positionTitle: string | null;
  companyName: string | null;
  durationMin: number;
  startedAt: string | null;
  transcript: TranscriptTurn[];
};

function formatElapsed(startedAt: string | null): string {
  if (!startedAt) return "—";
  const ms = Date.now() - new Date(startedAt).getTime();
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function CoObserverRoom({ token }: { token: string }) {
  const [session, setSession] = useState<ObserveSession | null>(null);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    try {
      const response = await fetch(`/api/observe/${token}`, { cache: "no-store" });
      const json = (await response.json()) as {
        session?: ObserveSession;
        error?: string;
      };
      if (!response.ok) {
        setError(json.error ?? "Observer link invalid or expired.");
        setSession(null);
        return;
      }
      setError("");
      setSession(json.session ?? null);
      setLastRefresh(new Date());
    } catch {
      setError("Unable to load observer view.");
    }
  }, [token]);

  useEffect(() => {
    void poll();
    const interval = window.setInterval(() => void poll(), 3000);
    return () => window.clearInterval(interval);
  }, [poll]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.transcript.length]);

  const isLive = session?.status === "LIVE";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-lg font-extrabold tracking-tight">Co-interviewer observer</h1>
              {isLive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
                  <Radio className="h-3 w-3" aria-hidden />
                  Live
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold uppercase text-muted-foreground">
                  {session?.status ?? "…"}
                </span>
              )}
            </div>
            {session ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {session.positionTitle ?? session.topic} · {session.candidateName ?? "Candidate"} ·{" "}
                {session.companyName ?? "Company"}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {session ? (
              <span>Elapsed {formatElapsed(session.startedAt)} / {session.durationMin} min slot</span>
            ) : null}
            <button
              type="button"
              onClick={() => void poll()}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 font-medium hover:bg-muted"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <p className="mb-6 rounded-lg border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          Read-only observer mode. Do not share this link publicly. The candidate is not notified when you join.
        </p>

        {error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}

        {session ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Transcript auto-updates every 3 seconds
              {lastRefresh ? ` · Last sync ${lastRefresh.toLocaleTimeString()}` : ""}
            </p>
            {session.transcript.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Waiting for conversation to begin…
              </p>
            ) : (
              <ul className="space-y-3">
                {session.transcript.map((turn) => (
                  <li
                    key={turn.orderIndex}
                    className={`rounded-xl border p-4 text-sm ${
                      turn.speaker === "CANDIDATE"
                        ? "border-border bg-card"
                        : "border-primary/20 bg-primary/5"
                    }`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wide text-primary mb-1">
                      {turn.speaker}
                    </p>
                    <p className="leading-relaxed">{turn.message}</p>
                  </li>
                ))}
                <div ref={transcriptEndRef} />
              </ul>
            )}
          </div>
        ) : !error ? (
          <p className="text-center text-muted-foreground py-12">Loading observer session…</p>
        ) : null}
      </main>
    </div>
  );
}
