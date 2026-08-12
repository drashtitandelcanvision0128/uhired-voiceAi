"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CreditCard,
  LifeBuoy,
  RefreshCw,
  ScrollText,
  Shield,
  TicketPercent,
  TrendingUp,
  Users,
} from "lucide-react";
import { MasterShell } from "@/components/master-shell";
import { MasterStuckSessionsPanel } from "@/components/master-stuck-sessions";
import {
  MASTER_PAGE_SIZE_OPTIONS,
  MasterPageSize,
  MasterPagination,
  paginateItems,
} from "@/components/master-pagination";

type DashboardAlert = {
  id: string;
  level: "info" | "warning" | "critical";
  title: string;
  body: string;
  href?: string;
};

type SessionTrendPoint = { label: string; total: number; practice: number; company: number };

type ChartPeriod = "weekly" | "monthly" | "yearly";

type DashboardResponse = {
  generatedAt: string;
  metrics: {
    totalCompanies: number;
    activeCompanies: number;
    inactiveCompanies: number;
    newCompanies30d: number;
    totalSessions: number;
    practiceSessions: number;
    companySessions: number;
    liveSessions: number;
    readySessions: number;
    completedSessions: number;
    sessionsLast30d: number;
    completionRatePct: number;
    practiceRevenue: number;
    revenueLast30d: number;
    uniquePayingUsers: number;
    promoCodesActive: number;
    promoRedemptions30d: number;
    supportNew: number;
    systemHealthPct: number;
  };
  weeklyTrend: SessionTrendPoint[];
  monthlyTrend: SessionTrendPoint[];
  yearlyTrend: SessionTrendPoint[];
  topDomains: Array<{ domain: string; sessions: number }>;
  recentSessions: Array<{
    id: string;
    type: string;
    name: string;
    email: string;
    domain: string;
    status: string;
    createdAt: string;
  }>;
  recentCompanies: Array<{
    id: string;
    name: string;
    domain: string;
    isActive: boolean;
    sessionCount: number;
    createdAt: string;
  }>;
  alerts: DashboardAlert[];
};

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const ALERT_STYLES: Record<DashboardAlert["level"], string> = {
  info: "admin-alert-banner",
  warning: "border-amber-200/80 bg-amber-50/90 text-amber-900",
  critical: "border-red-200/80 bg-red-50/90 text-red-900",
};

const STATUS_STYLES: Record<string, string> = {
  LIVE: "bg-red-50 text-red-700 ring-1 ring-red-200/70",
  READY: "bg-sky-50 text-sky-700 ring-1 ring-sky-200/70",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70",
};

function formatSessionDate(value: string) {
  const date = new Date(value);
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function companyInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?";
}

const QUICK_LINKS = [
  { href: "/master/companies", label: "Companies", icon: Building2 },
  { href: "/master/practice-sessions", label: "Sessions", icon: ScrollText },
  { href: "/master/payments", label: "Payments", icon: CreditCard },
  { href: "/master/support", label: "Support", icon: LifeBuoy },
  { href: "/master/security", label: "Security", icon: Shield },
  { href: "/master/reports", label: "Reports", icon: TrendingUp },
  { href: "/master/promo-codes", label: "Promo codes", icon: TicketPercent },
  { href: "/master/user-analytics", label: "Users", icon: Users },
];

const CHART_COLORS = ["#1e293b", "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b"];

const CHART_PERIOD_OPTIONS: Array<{
  id: ChartPeriod;
  label: string;
  title: string;
  subtitle: string;
}> = [
  {
    id: "weekly",
    label: "Weekly",
    title: "Sessions — last 7 days",
    subtitle: "Daily volume split by practice vs company sessions",
  },
  {
    id: "monthly",
    label: "Monthly",
    title: "Sessions — last 12 months",
    subtitle: "Monthly volume split by practice vs company sessions",
  },
  {
    id: "yearly",
    label: "Yearly",
    title: "Sessions — last 5 years",
    subtitle: "Yearly volume split by practice vs company sessions",
  },
];

function SessionTrendChart({
  points,
  period,
  maxTotal,
}: {
  points: SessionTrendPoint[];
  period: ChartPeriod;
  maxTotal: number;
}) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);

  useEffect(() => {
    setHoveredKey(null);
    setPinnedKey(null);
  }, [period]);

  const activeKey = pinnedKey ?? hoveredKey;
  const activePoint = points.find((point) => `${period}-${point.label}` === activeKey) ?? null;

  return (
    <div className="relative">
      <div className="flex h-56 items-end gap-2 overflow-x-auto pb-1 sm:gap-3">
        {points.map((point) => {
          const pointKey = `${period}-${point.label}`;
          const isActive = activeKey === pointKey;

          return (
            <button
              key={pointKey}
              type="button"
              className={`group relative flex min-w-[2.75rem] flex-1 cursor-pointer flex-col items-center gap-2 rounded-xl border border-transparent px-1 py-2 transition hover:border-slate-200 hover:bg-slate-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 ${
                isActive ? "border-slate-200 bg-slate-50/90" : ""
              }`}
              onMouseEnter={() => setHoveredKey(pointKey)}
              onMouseLeave={() => setHoveredKey(null)}
              onClick={() => setPinnedKey((current) => (current === pointKey ? null : pointKey))}
              aria-label={`${point.label}: ${point.total} total sessions`}
              aria-pressed={pinnedKey === pointKey}
            >
              {isActive ? (
                <div className="admin-chart-tooltip pointer-events-none absolute bottom-[calc(100%+0.35rem)] left-1/2 z-20 min-w-[9.5rem] -translate-x-1/2">
                  <p className="text-xs font-bold text-[#0f172a]">{point.label}</p>
                  <div className="mt-2 space-y-1.5">
                    <p className="flex items-center justify-between gap-3 text-[11px] text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm" style={{ background: CHART_COLORS[1] }} />
                        Practice
                      </span>
                      <span className="font-bold text-[#0f172a]">{point.practice}</span>
                    </p>
                    <p className="flex items-center justify-between gap-3 text-[11px] text-slate-600">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm" style={{ background: CHART_COLORS[0] }} />
                        Company
                      </span>
                      <span className="font-bold text-[#0f172a]">{point.company}</span>
                    </p>
                    <p className="flex items-center justify-between gap-3 border-t border-slate-100 pt-1.5 text-[11px] font-semibold text-slate-700">
                      <span>Total</span>
                      <span className="font-bold text-[#0f172a]">{point.total}</span>
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="flex w-full items-end justify-center gap-1" style={{ height: "180px" }}>
                <div
                  className={`w-2.5 rounded-t transition-all ${isActive ? "opacity-100 ring-2 ring-[#0f172a]/20" : "opacity-90 group-hover:opacity-100"}`}
                  style={{
                    height: `${Math.max(8, (point.company / maxTotal) * 160)}px`,
                    background: CHART_COLORS[0],
                  }}
                />
                <div
                  className={`w-2.5 rounded-t transition-all ${isActive ? "opacity-100 ring-2 ring-emerald-500/25" : "opacity-90 group-hover:opacity-100"}`}
                  style={{
                    height: `${Math.max(8, (point.practice / maxTotal) * 160)}px`,
                    background: CHART_COLORS[1],
                  }}
                />
              </div>
              <p className="text-center text-[10px] font-semibold text-slate-500">{point.label}</p>
              <p className={`text-[10px] font-bold ${isActive ? "text-emerald-700" : "text-[#0f172a]"}`}>
                {point.total}
              </p>
            </button>
          );
        })}
      </div>

      {activePoint ? (
        <p className="mt-3 text-center text-xs text-slate-500">
          <span className="font-semibold text-[#0f172a]">{activePoint.label}</span>
          {" · "}
          Practice <span className="font-bold text-emerald-700">{activePoint.practice}</span>
          {" · "}
          Company <span className="font-bold text-[#0f172a]">{activePoint.company}</span>
          {" · "}
          Total <span className="font-bold text-[#0f172a]">{activePoint.total}</span>
          {pinnedKey ? <span className="text-slate-400"> (pinned)</span> : null}
        </p>
      ) : (
        <p className="mt-3 text-center text-xs text-slate-400">Hover or click a bar to see session counts</p>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <article className="admin-card flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="text-2xl font-black tracking-tight text-[#0f172a]">{value}</p>
      <p className="text-[11px] leading-snug text-slate-500">{hint}</p>
    </article>
  );
}

export default function MasterDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionPageSize, setSessionPageSize] = useState<MasterPageSize>(MASTER_PAGE_SIZE_OPTIONS[0]);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("weekly");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/master/dashboard", { cache: "no-store" });
      const payload = (await res.json()) as DashboardResponse & { error?: string };
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok) {
        setError(payload.error ?? "Unable to load dashboard.");
        return;
      }
      setData(payload);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  const kpiCards = useMemo(() => {
    const metrics = data?.metrics;
    return [
      {
        label: "Total companies",
        value: metrics?.totalCompanies ?? 0,
        hint: `${metrics?.activeCompanies ?? 0} active · ${metrics?.newCompanies30d ?? 0} new (30d)`,
        icon: Building2,
        accent: "bg-emerald-50 text-emerald-600",
      },
      {
        label: "Total sessions",
        value: metrics?.totalSessions ?? 0,
        hint: `${metrics?.sessionsLast30d ?? 0} in last 30 days`,
        icon: ScrollText,
        accent: "bg-violet-50 text-violet-600",
      },
      {
        label: "Practice revenue",
        value: inrFormatter.format(metrics?.practiceRevenue ?? 0),
        hint: `${inrFormatter.format(metrics?.revenueLast30d ?? 0)} last 30d`,
        icon: CreditCard,
        accent: "bg-blue-50 text-blue-600",
      },
      {
        label: "Live now",
        value: metrics?.liveSessions ?? 0,
        hint: `${metrics?.readySessions ?? 0} ready · ${metrics?.completedSessions ?? 0} completed`,
        icon: Activity,
        accent: "bg-red-50 text-red-600",
      },
      {
        label: "Completion rate",
        value: `${metrics?.completionRatePct ?? 0}%`,
        hint: "Across all interview sessions",
        icon: TrendingUp,
        accent: "bg-amber-50 text-amber-600",
      },
      {
        label: "Paying users",
        value: metrics?.uniquePayingUsers ?? 0,
        hint: "Unique verified practice payments",
        icon: Users,
        accent: "bg-indigo-50 text-indigo-600",
      },
      {
        label: "Promo codes",
        value: metrics?.promoCodesActive ?? 0,
        hint: `${metrics?.promoRedemptions30d ?? 0} redemptions (30d)`,
        icon: TicketPercent,
        accent: "bg-purple-50 text-purple-600",
      },
      {
        label: "System health",
        value: `${metrics?.systemHealthPct ?? 0}%`,
        hint: `${metrics?.supportNew ?? 0} new support tickets`,
        icon: AlertTriangle,
        accent: "bg-teal-50 text-teal-600",
      },
    ];
  }, [data?.metrics]);

  const activeChartPeriod = CHART_PERIOD_OPTIONS.find((option) => option.id === chartPeriod) ?? CHART_PERIOD_OPTIONS[0];

  const chartTrend = useMemo(() => {
    if (!data) return [];
    if (chartPeriod === "monthly") return data.monthlyTrend ?? [];
    if (chartPeriod === "yearly") return data.yearlyTrend ?? [];
    return data.weeklyTrend ?? [];
  }, [chartPeriod, data]);

  const maxChartTotal = Math.max(...chartTrend.map((row) => row.total), 1);
  const paginatedSessions = paginateItems(data?.recentSessions ?? [], sessionPage, sessionPageSize);
  const currentYear = new Date().getFullYear();
  const metrics = data?.metrics;

  return (
    <MasterShell
      title="Dashboard"
      subtitle="Platform snapshot — companies, sessions, revenue, support, and system health at a glance."
      topActions={
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="admin-header-action-btn disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      }
    >
      {error ? (
        <div className="rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">
          {error}
        </div>
      ) : null}

      <div className="space-y-5">
        {data?.alerts.length ? (
          <section className="space-y-2">
            {data.alerts.map((alert) =>
              alert.level === "info" ? (
                <div key={alert.id} className="admin-alert-banner">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <p className="text-sm font-semibold text-emerald-900">{alert.title}</p>
                  </div>
                  {alert.href ? (
                    <Link
                      href={alert.href}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 transition hover:text-emerald-600"
                    >
                      View <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : null}
                </div>
              ) : (
                <div
                  key={alert.id}
                  className={`admin-card flex flex-wrap items-start justify-between gap-3 !rounded-xl px-4 py-3 ${ALERT_STYLES[alert.level]}`}
                >
                  <div>
                    <p className="text-sm font-bold">{alert.title}</p>
                    <p className="mt-1 text-xs opacity-90">{alert.body}</p>
                  </div>
                  {alert.href ? (
                    <Link
                      href={alert.href}
                      className="inline-flex items-center gap-1 rounded-lg bg-white/70 px-3 py-1.5 text-xs font-bold text-[#1a3352] transition hover:bg-white"
                    >
                      View <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : null}
                </div>
              ),
            )}
          </section>
        ) : null}

        {loading && !data ? (
          <>
            <div className="admin-hero relative overflow-hidden rounded-2xl p-5 text-white">
              <p className="text-sm text-blue-100/80">Loading platform analytics…</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div key={n} className="admin-card h-24 animate-pulse bg-slate-50" />
              ))}
            </div>
          </>
        ) : (
          <>
            <section className="admin-hero relative overflow-hidden rounded-2xl p-5 text-white md:p-6">
              <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                    Master Control · {currentYear}
                  </p>
                  <h2 className="mt-1 text-2xl font-extrabold tracking-tight md:text-[1.75rem]">
                    Uhired platform at a glance
                  </h2>
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {metrics?.activeCompanies ?? 0} active companies
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                      {metrics?.liveSessions ?? 0} live sessions
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                      {inrFormatter.format(metrics?.practiceRevenue ?? 0)} revenue
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/master/practice-sessions"
                    className="rounded-xl border border-white/30 bg-transparent px-3.5 py-2 text-xs font-bold text-white transition hover:bg-white/10"
                  >
                    View all sessions
                  </Link>
                  <Link
                    href="/master/companies"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-[#0f172a] shadow-sm transition hover:bg-slate-50"
                  >
                    Manage companies
                  </Link>
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {kpiCards.map((card) => (
                <KpiCard key={card.label} {...card} />
              ))}
            </section>

            <section className="flex flex-wrap gap-2">
              {QUICK_LINKS.map((link, index) => {
                const Icon = link.icon;
                const isActive = index === 0;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`admin-quick-tab ${isActive ? "admin-quick-tab-active" : ""}`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-emerald-600"}`} />
                    {link.label}
                  </Link>
                );
              })}
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
              <div className="admin-card-elevated p-5 sm:p-6">
                <p className="admin-section-title text-xl">{activeChartPeriod.title}</p>
                <p className="mb-5 text-sm text-slate-500">{activeChartPeriod.subtitle}</p>
                <SessionTrendChart points={chartTrend} period={chartPeriod} maxTotal={maxChartTotal} />
                <div className="mt-4 flex gap-4 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHART_COLORS[1] }} /> Practice
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CHART_COLORS[0] }} /> Company
                  </span>
                </div>
                <div className="admin-chart-period-tabs">
                  {CHART_PERIOD_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setChartPeriod(option.id)}
                      className={`admin-chart-period-tab ${chartPeriod === option.id ? "admin-chart-period-tab-active" : ""}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                <div className="admin-card p-5 sm:p-6">
                  <p className="admin-section-title text-lg">Session mix</p>
                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
                        <span>Practice</span>
                        <span>{metrics?.practiceSessions ?? 0}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{
                            width: `${metrics?.totalSessions ? ((metrics.practiceSessions / metrics.totalSessions) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
                        <span>Company</span>
                        <span>{metrics?.companySessions ?? 0}</span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#0f172a] transition-all"
                          style={{
                            width: `${metrics?.totalSessions ? ((metrics.companySessions / metrics.totalSessions) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="admin-card p-5 sm:p-6">
                  <p className="admin-section-title text-lg">Top domains</p>
                  <ul className="mt-4 space-y-3">
                    {(data?.topDomains ?? []).map((row, index) => (
                      <li key={row.domain} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-slate-700">{row.domain}</span>
                        <span
                          className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                          style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                        >
                          {row.sessions}
                        </span>
                      </li>
                    ))}
                    {!data?.topDomains.length ? (
                      <li className="text-sm text-slate-500">No session data yet.</li>
                    ) : null}
                  </ul>
                </div>
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="admin-card-elevated p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <p className="admin-section-title text-lg">Recent sessions</p>
                  <Link
                    href="/master/practice-sessions"
                    className="text-xs font-bold text-emerald-700 transition hover:text-emerald-600"
                  >
                    View all &gt;
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        <th className="py-2 pr-3">Candidate</th>
                        <th className="pr-3">Type</th>
                        <th className="pr-3">Status</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSessions.items.map((session) => (
                        <tr key={session.id} className="border-b border-slate-50 transition hover:bg-slate-50/60">
                          <td className="py-3 pr-3">
                            <p className="font-semibold text-[#0f172a]">{session.name}</p>
                            <p className="text-xs text-slate-500">{session.domain}</p>
                          </td>
                          <td className="pr-3">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 ring-1 ring-slate-200/80">
                              {session.type}
                            </span>
                          </td>
                          <td className="pr-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[session.status] ?? "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80"}`}
                            >
                              {session.status === "LIVE" ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              ) : null}
                              {session.status}
                            </span>
                          </td>
                          <td className="text-xs text-slate-500">
                            {formatSessionDate(session.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <MasterPagination
                  page={sessionPage}
                  pageSize={sessionPageSize}
                  totalItems={data?.recentSessions.length ?? 0}
                  itemLabel="sessions"
                  onPageChange={setSessionPage}
                  onPageSizeChange={(size) => {
                    setSessionPageSize(size);
                    setSessionPage(1);
                  }}
                />
              </div>

              <div className="admin-card-elevated p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <p className="admin-section-title text-lg">Recent companies</p>
                  <Link
                    href="/master/companies"
                    className="text-xs font-bold text-emerald-700 transition hover:text-emerald-600"
                  >
                    View all &gt;
                  </Link>
                </div>
                <div className="space-y-2">
                  {(data?.recentCompanies ?? []).map((company) => (
                    <div
                      key={company.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 transition hover:border-slate-200 hover:bg-slate-50/50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1e293b] text-sm font-bold text-white">
                          {companyInitial(company.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#0f172a]">{company.name}</p>
                          <p className="truncate text-xs text-slate-500">
                            {company.domain} · Joined {new Date(company.createdAt).toLocaleDateString("en-IN")}
                          </p>
                        </div>
                      </div>
                      <p className="shrink-0 text-xs font-semibold text-slate-600">
                        <span className="font-bold text-[#0f172a]">{company.sessionCount}</span> sessions
                      </p>
                    </div>
                  ))}
                  {!data?.recentCompanies.length ? (
                    <p className="text-sm text-slate-500">No companies onboarded yet.</p>
                  ) : null}
                </div>
              </div>
            </section>

            {data?.generatedAt ? (
              <p className="text-center text-xs text-slate-400">
                Last updated {new Date(data.generatedAt).toLocaleString()}
              </p>
            ) : null}
          </>
        )}

        <MasterStuckSessionsPanel compact showViewAllLink />
      </div>
    </MasterShell>
  );
}
