"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarRange,
  Download,
  FileJson,
  GraduationCap,
  LifeBuoy,
  RefreshCw,
  ScrollText,
  Search,
  TicketPercent,
  TrendingUp,
  X,
} from "lucide-react";
import { MasterShell } from "@/components/master-shell";
import {
  MasterAlert,
  MasterCard,
  MasterHero,
  MasterInfoCard,
  MasterKpiCard,
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

const SECTION_ACCENTS: Record<string, string> = {
  "Company overview": "bg-primary/12 text-primary ring-primary/25",
  "Practice performance": "bg-violet/12 text-violet ring-violet/25",
  "Session activity": "bg-cyan/12 text-cyan ring-cyan/25",
  "Support inbox": "bg-success/12 text-success ring-success/25",
  "Promo codes": "bg-indigo-500/15 text-indigo-700 ring-indigo-500/25 dark:text-indigo-300",
};

const REPORT_SECTIONS = [
  {
    icon: Building2,
    title: "Company overview",
    description: "Total companies, active tenants, sessions per company, and admin contact emails.",
  },
  {
    icon: GraduationCap,
    title: "Practice performance",
    description: "Practice session volume, revenue, paying users, promo redemptions, and top domains.",
  },
  {
    icon: ScrollText,
    title: "Session activity",
    description: "Company vs practice split, completion rate, live sessions, and weekly trend chart.",
  },
  {
    icon: LifeBuoy,
    title: "Support inbox",
    description: "Support inquiries received in the period — who contacted you and current status.",
  },
  {
    icon: TicketPercent,
    title: "Promo codes",
    description: "Active promo codes and how many practice sessions used a promo bypass.",
  },
] as const;

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

type SessionTrendPeriod = "date" | "week" | "month" | "year";

const SESSION_TREND_LABELS: Record<SessionTrendPeriod, { title: string; subtitle: string }> = {
  date: {
    title: "Session trend (daily)",
    subtitle: "Interview sessions per day — last 7 days.",
  },
  week: {
    title: "Session trend (weekly)",
    subtitle: "Interview sessions per week — last 4 weeks.",
  },
  month: {
    title: "Session trend (monthly view)",
    subtitle: "Interview sessions per day — last 30 days.",
  },
  year: {
    title: "Session trend (yearly)",
    subtitle: "Interview sessions per month — last 12 months.",
  },
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
  push(["Top domains", "Sessions"]);
  for (const row of report.topDomains) push([row.domain, String(row.sessions)]);
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
        setError(payload.error ?? "Unable to generate report.");
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

  const appliedPeriodLabel =
    PERIOD_OPTIONS.find((option) => option.value === appliedPeriod)?.label ?? appliedPeriod;

  const sessionTrendChart = useMemo(
    () => buildSessionTrendChart(report?.sessionTrendTimestamps ?? [], sessionTrendPeriod),
    [report?.sessionTrendTimestamps, sessionTrendPeriod],
  );

  const maxTrend = Math.max(1, ...sessionTrendChart.map((item) => item.count));

  const sessionTrendMeta = SESSION_TREND_LABELS[sessionTrendPeriod];

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
    <MasterShell
      title="Platform Reports"
      subtitle="Generate and download a full snapshot of companies, sessions, revenue, and support."
      topActions={
        <button
          type="button"
          onClick={() => void load(appliedPeriod)}
          disabled={loading}
          className={`${masterBtnGhost} inline-flex items-center gap-2 !px-4 !py-2.5 disabled:opacity-60`}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      }
    >
      <div className="space-y-5">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

        <MasterHero
          badge="Platform reports"
          title="Platform snapshot & exports"
          subtitle="Build a single view of companies, sessions, revenue, promo usage, and support — then download JSON or CSV."
        />

        <MasterInfoCard title="What is Generate Report?">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Select a time period, generate a fresh snapshot of the entire Uhired platform, and share
            JSON or CSV with your team. The report includes company overview, practice performance,
            session activity, support inbox, and promo code usage for the selected period.
          </p>
        </MasterInfoCard>

        <MasterCard
          elevated
          title="Generate report"
          subtitle="Choose a time period and build a fresh platform snapshot."
        >
          <div className="rounded-xl border border-border bg-surface/40 p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <label className="block space-y-1.5">
                <span className="admin-label">Report period</span>
                <div className="relative max-w-md">
                  <CalendarRange
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <select
                    value={periodInput}
                    onChange={(event) => setPeriodInput(event.target.value as ReportPeriod)}
                    className={`${masterInputClass} w-full pl-10`}
                  >
                    {PERIOD_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-xs text-muted-foreground">
                  Currently showing: <span className="font-semibold text-foreground">{appliedPeriodLabel}</span>
                </span>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={generateReport}
                  disabled={loading}
                  className={`${masterBtnPrimary} inline-flex items-center gap-2 !px-5 disabled:opacity-60`}
                >
                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                  {loading ? "Generating..." : "Generate report"}
                </button>
                <button
                  type="button"
                  onClick={downloadJson}
                  disabled={!report || loading}
                  className={`${masterBtnGhost} inline-flex items-center gap-2 !px-4 disabled:opacity-60`}
                >
                  <FileJson className="h-4 w-4" aria-hidden="true" />
                  Download JSON
                </button>
                <button
                  type="button"
                  onClick={downloadCsv}
                  disabled={!report || loading}
                  className={`${masterBtnGhost} inline-flex items-center gap-2 !px-4 disabled:opacity-60`}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download CSV
                </button>
              </div>
            </div>
          </div>
        </MasterCard>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {REPORT_SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <MasterInfoCard key={section.title}>
                <div className="flex gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${
                      SECTION_ACCENTS[section.title] ?? "bg-primary/12 text-primary ring-primary/25"
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-extrabold text-foreground">{section.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{section.description}</p>
                  </div>
                </div>
              </MasterInfoCard>
            );
          })}
        </section>

        {report ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MasterKpiCard
                label="Companies"
                value={report.summary.totalCompanies}
                icon={Building2}
                accent="bg-primary/12 text-primary ring-primary/25"
              />
              <MasterKpiCard
                label="Total sessions"
                value={report.summary.totalSessions}
                icon={ScrollText}
                accent="bg-violet/12 text-violet ring-violet/25"
              />
              <MasterKpiCard
                label="Practice revenue"
                value={inrFormatter.format(report.summary.practiceRevenue)}
                icon={GraduationCap}
                accent="bg-success/12 text-success ring-success/25"
              />
              <MasterKpiCard
                label="Completion rate"
                value={`${report.summary.completionRatePct}%`}
                icon={TrendingUp}
                accent="bg-warning/12 text-warning ring-warning/25"
              />
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              <MasterCard
                title={sessionTrendMeta.title}
                subtitle={sessionTrendMeta.subtitle}
                headerAction={
                  <div className="flex rounded-lg border border-border bg-surface/40 p-1">
                    {(["date", "week", "month", "year"] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setSessionTrendPeriod(period)}
                        className={`rounded-md px-2.5 py-1.5 text-xs font-semibold capitalize transition sm:px-3 ${
                          sessionTrendPeriod === period
                            ? "text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        style={
                          sessionTrendPeriod === period
                            ? { background: "var(--gradient-brand)" }
                            : undefined
                        }
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                }
              >
                <div
                  className={`flex h-48 items-end gap-1.5 rounded-xl border border-border bg-surface/30 p-3 ${
                    sessionTrendPeriod === "month" ? "overflow-x-auto pb-1" : ""
                  }`}
                >
                  {sessionTrendChart.map((point, index) => {
                    const isPeak = point.count === maxTrend && point.count > 0;
                    return (
                      <div
                        key={`${point.label}-${index}`}
                        className={`flex flex-col items-center gap-2 ${
                          sessionTrendPeriod === "month" ? "min-w-[1.35rem] flex-none" : "flex-1"
                        }`}
                      >
                        <p className="text-xs font-semibold text-foreground">{point.count}</p>
                        <div
                          className={`w-full rounded-t-md shadow-sm ${
                            isPeak
                              ? "bg-gradient-to-t from-emerald-500 to-success ring-2 ring-success/40"
                              : "bg-gradient-to-t from-primary/60 to-primary"
                          }`}
                          style={{ height: `${Math.max(12, (point.count / maxTrend) * 140)}px` }}
                        />
                        <p
                          className={`font-semibold uppercase text-muted-foreground ${
                            sessionTrendPeriod === "month" ? "text-[9px]" : "text-[10px]"
                          }`}
                        >
                          {point.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </MasterCard>

              <MasterCard title="Report summary" subtitle="Key metrics for this snapshot.">
                <div className="space-y-2 text-sm">
                  {[
                    ["Period", report.meta.periodLabel],
                    ["Generated", new Date(report.meta.generatedAt).toLocaleString()],
                    ["Practice sessions", report.summary.practiceSessions],
                    ["Company sessions", report.summary.companySessions],
                    ["Live now", report.summary.liveSessions],
                    ["Paying users", report.summary.uniquePayingUsers],
                    ["Promo redemptions", report.summary.promoRedemptions],
                    ["Support inquiries", report.summary.supportInquiries],
                    ["New support tickets", report.summary.supportNew],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-3 py-2.5"
                    >
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-bold text-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </MasterCard>
            </div>

            <MasterCard title="Top interview domains">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {report.topDomains.map((track) => (
                  <article
                    key={track.domain}
                    className="glow-card rounded-xl border border-border bg-surface/40 p-4"
                  >
                    <p className="text-sm font-semibold text-foreground">{track.domain}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{track.sessions} sessions</p>
                  </article>
                ))}
              </div>
            </MasterCard>

            <MasterCard
              elevated
              title="Companies in report"
              subtitle="Search companies included in this report snapshot."
            >
              <div className="mb-5 rounded-xl border border-border bg-surface/40 p-4 sm:p-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <label className="block space-y-1.5">
                    <span className="admin-label">Search companies</span>
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <input
                        value={companySearchInput}
                        onChange={(event) => setCompanySearchInput(event.target.value)}
                        onKeyDown={handleCompanySearchKeyDown}
                        placeholder="Company name, domain, admin email..."
                        className={`${masterInputClass} w-full pl-10`}
                      />
                    </div>
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={applyCompanySearch}
                      className={`${masterBtnPrimary} inline-flex items-center gap-2 !px-5`}
                    >
                      <Search className="h-4 w-4" aria-hidden="true" />
                      Search
                    </button>
                    {appliedCompanySearch ? (
                      <button
                        type="button"
                        onClick={clearCompanySearch}
                        className={`${masterBtnGhost} inline-flex items-center gap-2 !px-4`}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>

                {appliedCompanySearch ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Active filters
                    </span>
                    <span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
                      Search: {appliedCompanySearch}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {filteredCompanies.length} of {report.companies.length} companies
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className={masterTableHeadClass}>
                      <th className="py-3 pr-4">Company</th>
                      <th className="pr-4">Domain</th>
                      <th className="pr-4">Admin</th>
                      <th className="pr-4">Sessions</th>
                      <th className="pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.map((company) => (
                      <tr
                        key={company.name}
                        className="border-b border-border transition hover:bg-surface/40"
                      >
                        <td className="py-3 pr-4 font-semibold text-foreground">{company.name}</td>
                        <td className="pr-4 text-muted-foreground">{company.domain}</td>
                        <td className="pr-4 text-muted-foreground">{company.adminEmail}</td>
                        <td className="pr-4 font-medium text-foreground">{company.totalSessions}</td>
                        <td className="pr-4">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                              company.isActive
                                ? "bg-success/12 text-success ring-success/25"
                                : "bg-surface/80 text-muted-foreground ring-border"
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
                <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface/30 px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-foreground">No companies match your search</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Try a different company name, domain, or admin email.
                  </p>
                  {appliedCompanySearch ? (
                    <button
                      type="button"
                      onClick={clearCompanySearch}
                      className={`${masterBtnGhost} mt-4 inline-flex items-center gap-2`}
                    >
                      <X className="h-4 w-4" aria-hidden />
                      Clear search
                    </button>
                  ) : null}
                </div>
              ) : null}
            </MasterCard>
          </>
        ) : null}

        {loading && !report ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-24 animate-pulse rounded-2xl bg-surface/60" />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Generating platform report…</p>
          </div>
        ) : null}
      </div>
    </MasterShell>
  );
}
