"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Download,
  FileJson,
  GraduationCap,
  RefreshCw,
  ScrollText,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import { MasterShell } from "@/components/master-shell";
import {
  MasterAlert,
  MasterSelect,
  masterBtnGhost,
  masterBtnPrimary,
  masterInputClass,
  masterTableHeadClass,
} from "@/components/master-ui";

type ReportPeriod = "7d" | "30d" | "90d" | "all";

type PlatformReport = {
  meta: {
    generatedAt: string;
    period: ReportPeriod;
    periodLabel: string;
    periodStart: string | null;
    appUrl: string;
  };
  summary: {
    totalCompanies: number;
    activeCompanies: number;
    totalSessions: number;
    practiceSessions: number;
    companySessions: number;
    completedSessions: number;
    liveSessions: number;
    completionRatePct: number;
    practiceRevenue: number;
    uniquePayingUsers: number;
    promoCodesActive: number;
    promoRedemptions: number;
    supportInquiries: number;
    supportNew: number;
  };
  weeklyTrend: Array<{ label: string; count: number }>;
  sessionTrendTimestamps: string[];
  topDomains: Array<{ domain: string; sessions: number }>;
  companies: Array<{
    name: string;
    domain: string;
    adminEmail: string;
    isActive: boolean;
    totalSessions: number;
    createdAt: string;
  }>;
  practiceHighlights: Array<{
    candidateName: string;
    candidateEmail: string;
    domain: string;
    status: string;
    durationMin: number;
    paymentType: string;
    score: number | null;
    createdAt: string;
  }>;
  promoCodes: Array<{
    code: string;
    durationMin: number;
    isActive: boolean;
    createdAt: string;
  }>;
  supportInquiries: Array<{
    name: string;
    email: string;
    subject: string;
    source: string;
    status: string;
    createdAt: string;
  }>;
};

const PERIOD_OPTIONS: Array<{ value: ReportPeriod; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatTrack(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\banaytics\b/gi, "analytics")
    .replace(/\bdevloper\b/gi, "developer")
    .split(" ")
    .map((word) => {
      const core = word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");
      if (!core) return word;
      const lower = core.toLowerCase();
      const formatted =
        lower === "hr" || lower === "qa" || lower === "it" || lower === "ai"
          ? lower.toUpperCase()
          : lower.charAt(0).toUpperCase() + lower.slice(1);
      return word.replace(core, formatted);
    })
    .join(" ");
}

type SessionTrendPeriod = "date" | "week" | "month" | "year";

const SESSION_TREND_LABELS: Record<SessionTrendPeriod, string> = {
  date: "Sessions (7 days)",
  week: "Sessions (4 weeks)",
  month: "Sessions (30 days)",
  year: "Sessions (12 months)",
};

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function countSessionsInRange(timestamps: string[], start: Date, end: Date) {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return timestamps.filter((timestamp) => {
    const ts = new Date(timestamp).getTime();
    return ts >= startMs && ts < endMs;
  }).length;
}

function buildSessionTrendChart(timestamps: string[], period: SessionTrendPeriod) {
  const today = startOfDay(new Date());

  if (period === "date") {
    return Array.from({ length: 7 }, (_, index) => {
      const daysAgo = 6 - index;
      const day = new Date(today);
      day.setDate(day.getDate() - daysAgo);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      return {
        label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        count: countSessionsInRange(timestamps, day, nextDay),
      };
    });
  }

  if (period === "week") {
    return Array.from({ length: 4 }, (_, index) => {
      const weeksAgo = 3 - index;
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() - weeksAgo * 7 + 1);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 7);
      return {
        label: weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        count: countSessionsInRange(timestamps, weekStart, weekEnd),
      };
    });
  }

  if (period === "month") {
    return Array.from({ length: 30 }, (_, index) => {
      const daysAgo = 29 - index;
      const day = new Date(today);
      day.setDate(day.getDate() - daysAgo);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      return {
        label: day.getDate().toString(),
        count: countSessionsInRange(timestamps, day, nextDay),
      };
    });
  }

  return Array.from({ length: 12 }, (_, index) => {
    const monthsAgo = 11 - index;
    const monthStart = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() - monthsAgo + 1, 1);
    return {
      label: monthStart.toLocaleDateString(undefined, { month: "short" }),
      count: countSessionsInRange(timestamps, monthStart, monthEnd),
    };
  });
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function reportToCsv(report: PlatformReport) {
  const lines: string[] = [];
  const push = (row: string[]) => lines.push(row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","));

  push(["Uhired Platform Report"]);
  push(["Generated at", report.meta.generatedAt]);
  push(["Period", report.meta.periodLabel]);
  push([]);
  push(["Summary Metric", "Value"]);
  push(["Total companies", String(report.summary.totalCompanies)]);
  push(["Active companies", String(report.summary.activeCompanies)]);
  push(["Total sessions", String(report.summary.totalSessions)]);
  push(["Practice sessions", String(report.summary.practiceSessions)]);
  push(["Company sessions", String(report.summary.companySessions)]);
  push(["Completed sessions", String(report.summary.completedSessions)]);
  push(["Completion rate %", String(report.summary.completionRatePct)]);
  push(["Practice revenue (INR)", String(report.summary.practiceRevenue)]);
  push(["Unique paying users", String(report.summary.uniquePayingUsers)]);
  push(["Promo redemptions", String(report.summary.promoRedemptions)]);
  push(["Support inquiries", String(report.summary.supportInquiries)]);
  push([]);
  push(["Top interview topics", "Interviews"]);
  for (const row of report.topDomains) push([formatTrack(row.domain), String(row.sessions)]);
  push([]);
  push(["Companies", "Domain", "Admin email", "Active", "Sessions"]);
  for (const company of report.companies) {
    push([
      company.name,
      company.domain,
      company.adminEmail,
      company.isActive ? "Yes" : "No",
      String(company.totalSessions),
    ]);
  }
  push([]);
  push(["Support inquiries", "Email", "Subject", "Source", "Status"]);
  for (const inquiry of report.supportInquiries) {
    push([inquiry.name, inquiry.email, inquiry.subject, inquiry.source, inquiry.status]);
  }

  return lines.join("\n");
}

export default function MasterReportsPage() {
  const router = useRouter();
  const [periodInput, setPeriodInput] = useState<ReportPeriod>("30d");
  const [appliedPeriod, setAppliedPeriod] = useState<ReportPeriod>("30d");
  const [report, setReport] = useState<PlatformReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [companySearchInput, setCompanySearchInput] = useState("");
  const [appliedCompanySearch, setAppliedCompanySearch] = useState("");
  const [sessionTrendPeriod, setSessionTrendPeriod] = useState<SessionTrendPeriod>("date");

  const load = useCallback(async (period: ReportPeriod) => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/master/reports?period=${period}`);
      const payload = (await res.json()) as PlatformReport & { error?: string };
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok) {
        setError(payload.error ?? "Could not generate report.");
        return;
      }
      setReport(payload);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load(appliedPeriod);
  }, [appliedPeriod, load]);

  function generateReport() {
    setAppliedCompanySearch("");
    setCompanySearchInput("");
    if (periodInput === appliedPeriod) {
      void load(periodInput);
      return;
    }
    setAppliedPeriod(periodInput);
  }

  function applyCompanySearch() {
    setAppliedCompanySearch(companySearchInput.trim());
  }

  function clearCompanySearch() {
    setCompanySearchInput("");
    setAppliedCompanySearch("");
  }

  function handleCompanySearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      applyCompanySearch();
    }
  }

  const filteredCompanies = useMemo(() => {
    const query = appliedCompanySearch.toLowerCase();
    if (!query) return report?.companies ?? [];
    return (report?.companies ?? []).filter(
      (company) =>
        company.name.toLowerCase().includes(query) ||
        company.domain.toLowerCase().includes(query) ||
        company.adminEmail.toLowerCase().includes(query),
    );
  }, [report?.companies, appliedCompanySearch]);

  const sessionTrendChart = useMemo(
    () => buildSessionTrendChart(report?.sessionTrendTimestamps ?? [], sessionTrendPeriod),
    [report?.sessionTrendTimestamps, sessionTrendPeriod],
  );

  const maxTrend = Math.max(1, ...sessionTrendChart.map((item) => item.count));

  const sessionTrendTitle = SESSION_TREND_LABELS[sessionTrendPeriod];

  function downloadJson() {
    if (!report) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`uhired-platform-report-${stamp}.json`, JSON.stringify(report, null, 2), "application/json");
  }

  function downloadCsv() {
    if (!report) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`uhired-platform-report-${stamp}.csv`, reportToCsv(report), "text/csv");
  }

  return (
    <MasterShell title="Reports" subtitle="Pick a date range, then download.">
      <div className="space-y-3">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

        <section className="admin-card p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[10rem] space-y-1">
              <span className="admin-label">Period</span>
              <MasterSelect
                value={periodInput}
                onValueChange={(value) => setPeriodInput(value as ReportPeriod)}
                className="w-full min-w-[10rem]"
                aria-label="Report period"
                options={PERIOD_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            </label>
            <button
              type="button"
              onClick={generateReport}
              disabled={loading}
              className={`${masterBtnPrimary} !px-4 disabled:opacity-60`}
            >
              {loading ? "Loading…" : "Update"}
            </button>
            <button
              type="button"
              onClick={downloadCsv}
              disabled={!report || loading}
              className={`${masterBtnGhost} inline-flex items-center gap-1.5 disabled:opacity-60`}
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <button
              type="button"
              onClick={downloadJson}
              disabled={!report || loading}
              className={`${masterBtnGhost} inline-flex items-center gap-1.5 disabled:opacity-60`}
            >
              <FileJson className="h-4 w-4" />
              JSON
            </button>
            <button
              type="button"
              onClick={() => void load(appliedPeriod)}
              disabled={loading}
              className={`${masterBtnGhost} inline-flex h-10 items-center justify-center !px-3 disabled:opacity-60`}
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </section>

        {loading && !report ? (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          </div>
        ) : null}

        {report ? (
          <>
            <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <article className="admin-card flex items-center gap-3 p-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <Building2 className="size-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Companies</p>
                  <p className="text-lg font-semibold text-foreground">{report.summary.totalCompanies}</p>
                </div>
              </article>
              <article className="admin-card flex items-center gap-3 p-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-violet/12 text-violet">
                  <ScrollText className="size-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sessions</p>
                  <p className="text-lg font-semibold text-foreground">{report.summary.totalSessions}</p>
                </div>
              </article>
              <article className="admin-card flex items-center gap-3 p-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-success/12 text-success">
                  <GraduationCap className="size-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <p className="text-lg font-semibold text-foreground">
                    {inrFormatter.format(report.summary.practiceRevenue)}
                  </p>
                </div>
              </article>
              <article className="admin-card flex items-center gap-3 p-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-warning/12 text-warning">
                  <TrendingUp className="size-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-lg font-semibold text-foreground">{report.summary.completionRatePct}%</p>
                </div>
              </article>
            </section>

            <div className="grid gap-3 lg:grid-cols-5">
              <section className="admin-card p-4 lg:col-span-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{sessionTrendTitle}</p>
                  <div className="flex rounded-lg bg-muted/70 p-0.5 ring-1 ring-border">
                    {(["date", "week", "month", "year"] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setSessionTrendPeriod(period)}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize ${
                          sessionTrendPeriod === period
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {period === "date" ? "Day" : period}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={`flex h-40 items-end gap-1.5 ${sessionTrendPeriod === "month" ? "overflow-x-auto pb-1" : ""}`}>
                  {sessionTrendChart.map((point, index) => {
                    const heightPct = Math.max(8, (point.count / maxTrend) * 100);
                    return (
                      <div
                        key={`${point.label}-${index}`}
                        className={`flex flex-col items-center gap-1.5 ${
                          sessionTrendPeriod === "month" ? "min-w-[1.3rem] flex-none" : "min-w-0 flex-1"
                        }`}
                      >
                        <p className="text-[10px] font-semibold text-foreground">{point.count}</p>
                        <div className="flex h-24 w-full items-end justify-center rounded-md bg-muted/60 px-0.5">
                          <div
                            className="w-full max-w-[1.75rem] rounded-t-md"
                            style={{
                              height: `${heightPct}%`,
                              background: point.count > 0 ? "var(--gradient-brand)" : "transparent",
                            }}
                            title={`${point.label}: ${point.count}`}
                          />
                        </div>
                        <p className={`text-muted-foreground ${sessionTrendPeriod === "month" ? "text-[8px]" : "text-[10px]"}`}>
                          {point.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="admin-card p-4 lg:col-span-2">
                <p className="mb-3 text-sm font-semibold text-foreground">Snapshot</p>
                <div className="space-y-2 text-sm">
                  {[
                    ["Period", report.meta.periodLabel],
                    ["Practice", report.summary.practiceSessions],
                    ["Company", report.summary.companySessions],
                    ["Live", report.summary.liveSessions],
                    ["Paying", report.summary.uniquePayingUsers],
                    ["Promos used", report.summary.promoRedemptions],
                    ["Support", report.summary.supportInquiries],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold text-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="admin-card p-4">
              <p className="mb-3 text-sm font-semibold text-foreground">Top tracks</p>
              {report.topDomains.length ? (
                <div className="flex flex-wrap gap-2">
                  {report.topDomains.map((track) => (
                    <span
                      key={track.domain}
                      className="rounded-md border border-border bg-surface/50 px-2.5 py-1 text-xs text-foreground"
                    >
                      {formatTrack(track.domain)}{" "}
                      <span className="text-muted-foreground">
                        {track.sessions} {track.sessions === 1 ? "session" : "sessions"}
                      </span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No tracks yet.</p>
              )}
            </section>

            <section className="admin-card overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
                <div className="relative min-w-[12rem] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={companySearchInput}
                    onChange={(event) => setCompanySearchInput(event.target.value)}
                    onKeyDown={handleCompanySearchKeyDown}
                    placeholder="Company, domain, or email"
                    className={`${masterInputClass} w-full pl-10`}
                    aria-label="Search companies"
                  />
                </div>
                <button type="button" onClick={applyCompanySearch} className={`${masterBtnPrimary} !px-4`}>
                  Search
                </button>
                {appliedCompanySearch ? (
                  <button
                    type="button"
                    onClick={clearCompanySearch}
                    className={`${masterBtnGhost} inline-flex h-10 items-center !px-3`}
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead>
                    <tr className={masterTableHeadClass}>
                      <th className="px-3 py-2">Company</th>
                      <th className="pr-4">Domain</th>
                      <th className="pr-4">Admin</th>
                      <th className="pr-4">Sessions</th>
                      <th className="pr-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.map((company) => (
                      <tr key={company.name} className="border-b border-border last:border-0 hover:bg-muted/40">
                        <td className="px-3 py-2.5 font-semibold text-foreground">{company.name}</td>
                        <td className="pr-4 text-muted-foreground">{company.domain}</td>
                        <td className="pr-4 text-muted-foreground">{company.adminEmail}</td>
                        <td className="pr-4 font-medium text-foreground">{company.totalSessions}</td>
                        <td className="pr-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${
                              company.isActive
                                ? "bg-success/12 text-success ring-success/25"
                                : "bg-muted text-muted-foreground ring-border"
                            }`}
                          >
                            {company.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!filteredCompanies.length ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">No companies found.</p>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </MasterShell>
  );
}
