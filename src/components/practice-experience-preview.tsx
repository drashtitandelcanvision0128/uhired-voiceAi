"use client";

import { useEffect, useState } from "react";
import { Maximize2, Play, Settings } from "lucide-react";
import type { PracticePreviewContent } from "@/lib/practice-focus-areas";

const SESSION_PREVIEW_IMAGE = {
  src: "/marketing/session-preview-bg.png",
  alt: "Professional practicing AI mock interview with real-time coaching feedback on laptop",
} as const;

type PracticeExperiencePreviewProps = {
  preview: PracticePreviewContent;
  onTryFree?: () => void;
  freeLoading?: boolean;
  freeError?: string;
  variant?: "default" | "practice-page";
};

export function PracticeExperiencePreview({
  preview,
  onTryFree,
  freeLoading = false,
  freeError = "",
  variant = "default",
}: PracticeExperiencePreviewProps) {
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [demoPhase, setDemoPhase] = useState<"speaking" | "listening">("listening");

  useEffect(() => {
    if (!demoPlaying) {
      setDemoPhase("listening");
      return;
    }

    setDemoPhase("listening");
    const switchTimer = window.setTimeout(() => setDemoPhase("speaking"), 3000);
    const loopTimer = window.setInterval(() => {
      setDemoPhase("listening");
      window.setTimeout(() => setDemoPhase("speaking"), 3000);
    }, 8000);

    return () => {
      window.clearTimeout(switchTimer);
      window.clearInterval(loopTimer);
    };
  }, [demoPlaying, preview.sampleQuestion]);

  function handlePlayClick() {
    if (onTryFree) {
      onTryFree();
      return;
    }
    setDemoPlaying((playing) => !playing);
  }

  if (variant === "practice-page") {
    return (
      <section className="mb-12" aria-label="Interview preview">
        <div className="relative rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.12)] bg-[#1a1a2e] aspect-[16/9] max-h-[480px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SESSION_PREVIEW_IMAGE.src}
            alt={SESSION_PREVIEW_IMAGE.alt}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-black/20" />

          <div className="absolute top-4 left-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-card/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              AI Coach Active
            </span>
          </div>

          <div className="absolute top-4 right-4 flex gap-2">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-card/90 text-primary shadow-sm transition hover:bg-card"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-card/90 text-primary shadow-sm transition hover:bg-card"
              aria-label="Expand"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              onClick={handlePlayClick}
              disabled={freeLoading}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white shadow-[0_8px_30px_rgba(0,85,212,0.5)] transition hover:bg-primary/90 hover:scale-105 disabled:opacity-70"
              aria-label={onTryFree ? "Start free preview" : "Play demo"}
            >
              <Play className="h-9 w-9 fill-white ml-1" />
            </button>
          </div>

          <div className="absolute bottom-5 left-5 max-w-xs rounded-xl border border-primary/20 bg-card/95 p-4 shadow-lg backdrop-blur-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1.5">
              Real-time Insight
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {preview.sampleFeedback}
            </p>
          </div>

          <div className="absolute bottom-5 right-5 hidden sm:flex gap-4">
            <div className="rounded-lg bg-card/90 px-3 py-2 shadow-sm backdrop-blur-sm">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Volume
              </p>
              <div className="flex items-end gap-0.5 h-6">
                {[40, 65, 85, 55, 70].map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 rounded-full bg-primary"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="rounded-lg bg-card/90 px-3 py-2 shadow-sm backdrop-blur-sm">
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Clarity
              </p>
              <div className="flex items-end gap-0.5 h-6">
                {[55, 75, 90, 80, 65].map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 rounded-full bg-primary"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {freeLoading ? (
          <p className="mt-3 text-center text-sm text-primary font-medium">
            Starting preview...
          </p>
        ) : null}
        {freeError ? <p className="mt-3 text-center text-sm text-red-600">{freeError}</p> : null}
      </section>
    );
  }

  return (
    <section
      id="preview-section"
      className="py-16 md:py-20 bg-background scroll-mt-20"
      aria-label="Interview preview"
    >
      <div className="container max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
              See what your session looks like
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              Experience a realistic AI interview with real-time coaching feedback.
            </p>
          </div>
        </div>

        <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-[#1a1a2e] aspect-[16/9] max-h-[520px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SESSION_PREVIEW_IMAGE.src}
            alt={SESSION_PREVIEW_IMAGE.alt}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />

          <div className="absolute top-4 right-4 flex gap-2">
            <button
              type="button"
              onClick={() => setDemoPlaying((playing) => !playing)}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition"
              aria-label={demoPlaying ? "Pause demo" : "Play demo"}
            >
              <Play className="w-4 h-4 fill-white" />
            </button>
          </div>

          <div className="absolute bottom-24 left-6 flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-primary rounded-full animate-pulse"
                  style={{
                    height: `${12 + Math.sin(i) * 8}px`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-white">
              {demoPhase === "listening" ? "AI is listening..." : "AI is speaking..."}
            </span>
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-lg w-[90%]">
            <div className="bg-black/60 backdrop-blur-md rounded-xl px-6 py-4 text-center">
              <p className="text-sm md:text-base text-white/95 leading-relaxed italic">
                &ldquo;{preview.sampleQuestion}&rdquo;
              </p>
            </div>
          </div>

          <div className="absolute bottom-6 right-6 w-64 md:w-72 bg-card rounded-xl shadow-xl p-4 hidden sm:block">
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              {preview.sampleFeedback}
            </p>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Clarity</span>
                <span className="font-semibold text-primary">75%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full w-3/4 bg-primary rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {onTryFree ? (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl bg-muted/50 border border-border">
            <div>
              <p className="text-sm font-bold text-foreground">Try one question free</p>
              <p className="text-xs text-muted-foreground mt-1">
                No payment required — experience the full interview flow.
              </p>
            </div>
            <button
              type="button"
              onClick={onTryFree}
              disabled={freeLoading}
              className="shrink-0 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
            >
              {freeLoading ? "Starting preview..." : "Start Free Preview"}
            </button>
          </div>
        ) : null}
        {freeError ? <p className="mt-3 text-sm text-red-600">{freeError}</p> : null}
      </div>
    </section>
  );
}
