import type { Metadata } from "next";
import Link from "next/link";
import {
  Video,
  VideoIcon,
  Clock,
  ArrowRight,
  Zap,
  MoreVertical,
  Layers,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { MarketingBackground } from "@/components/marketing/site/marketing-page-shell";

export const metadata: Metadata = {
  title: "Sessions",
  description: "View and configure your Uhired mock interview sessions.",
};

const recentSessions = [
  {
    id: "1",
    title: "Senior Software Engineer",
    subtitle: "System Design • 45 minutes",
    matchPercent: 84,
    lastUpdated: "2h ago",
  },
  {
    id: "2",
    title: "Product Manager",
    subtitle: "Behavioral • 30 minutes",
    matchPercent: 72,
    lastUpdated: "1d ago",
  },
];

export default function SessionsPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20">
      <MarketingBackground />
      <SiteHeader />

      <main className="flex-1">
        <section className="pt-10 pb-16 md:pt-14 md:pb-20">
          <div className="container max-w-7xl mx-auto px-4 md:px-8">
            {/* Hero */}
            <div className="max-w-2xl mb-10 md:mb-12">
              <span className="glass-light mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/20">
                  <Clock className="h-2.5 w-2.5" />
                </span>
                Sessions
              </span>
              <h1 className="text-3xl md:text-[2.5rem] font-extrabold text-foreground tracking-tight mb-4 leading-tight">
                Your interview sessions
              </h1>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                Configure a new mock interview or continue where you left off.
                Each session is tailored to your role and includes real-time AI
                coaching feedback.
              </p>
            </div>

            {/* Action cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6 mb-14 md:mb-16">
              {/* Start a new session */}
              <div className="glass relative overflow-hidden rounded-2xl p-7 md:p-8">
                <div className="relative z-10">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                    <Video className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground mb-2">
                    Start a new session
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-7 max-w-xs">
                    Choose your focus area, set duration, and begin practicing
                    with your AI interview coach.
                  </p>
                  <Link
                    href="/#booking-section"
                    className="btn-glow inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white no-underline"
                  >
                    Configure Session
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                {/* Watermark */}
                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 opacity-[0.07]">
                  <div className="relative">
                    <VideoIcon className="h-36 w-36 text-foreground" strokeWidth={1} />
                    <span className="absolute -right-1 -top-1 flex h-10 w-10 items-center justify-center rounded-full border-4 border-background bg-primary/10 text-3xl font-light text-foreground">
                      +
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick practice */}
              <div className="glass-light rounded-2xl p-7 md:p-8">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-card/80">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  Quick practice
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-7 max-w-xs">
                  Jump straight into a practice interview with your preferred
                  role and duration settings.
                </p>
                <Link
                  href="/practice"
                  className="glass-light inline-flex items-center gap-2 rounded-full border border-primary/30 px-5 py-2.5 text-sm font-semibold text-primary no-underline transition-all hover:border-primary"
                >
                  <Zap className="h-4 w-4" />
                  Go to Practice
                </Link>
              </div>
            </div>

            {/* Recent Sessions */}
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-foreground">
                  Recent Sessions
                </h2>
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary no-underline transition-colors hover:text-primary/80"
                >
                  View All History
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    className="glass flex items-center gap-4 rounded-xl px-5 py-4 md:px-6 md:py-5"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Layers className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm md:text-base font-bold text-foreground truncate">
                        {session.title}
                      </p>
                      <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                        {session.subtitle}
                      </p>
                    </div>

                    <div className="hidden sm:flex flex-col items-end shrink-0 mr-2">
                      <p className="text-sm font-bold text-primary">
                        {session.matchPercent}% Match
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Last updated {session.lastUpdated}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                      aria-label="Session options"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
