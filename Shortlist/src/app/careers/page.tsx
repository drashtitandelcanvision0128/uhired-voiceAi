"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { MarketingBackground } from "@/components/marketing/site/marketing-page-shell";

type Job = {
  id: string;
  title: string;
  excerpt: string | null;
  body: string;
  location: string | null;
  employmentType: string | null;
};

export default function CareersPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/public/content/careers", { cache: "no-store" });
        const data = (await res.json()) as { jobs?: Job[] };
        setJobs(data.jobs ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground">
      <MarketingBackground />
      <SiteHeader />
      <main className="flex-1 container max-w-3xl mx-auto px-4 py-16 md:px-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-4">Careers at Uhired</h1>
        <p className="text-muted-foreground mb-10 max-w-2xl">
          Join us in building AI-powered interviews that help candidates and companies hire with clarity.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading openings…</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open roles published yet.</p>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="rounded-xl border border-border bg-card p-5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-lg">{job.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {[job.location, job.employmentType].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Link
                    href="/contact"
                    className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white no-underline hover:opacity-90"
                  >
                    Apply
                  </Link>
                </div>
                {job.excerpt ? <p className="text-sm text-muted-foreground">{job.excerpt}</p> : null}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{job.body}</p>
              </div>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
