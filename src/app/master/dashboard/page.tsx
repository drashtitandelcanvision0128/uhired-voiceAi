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
  Eye,
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
import { MasterSelect } from "@/components/master-ui";

type DashboardAlert = {
  id: string;
  level: "info" | "warning" | "critical";
  title: string;
  body: string;
  href?: string;
};

type SessionTrendPoint = { label: string; total: number; practice: number; company: number };

type ChartPeriod = "weekly" | "monthly" | "yearly";

type TopicDomainRow = { domain: string; sessions: number };
type TopicPeriodData = { total: number; rows: TopicDomainRow[] };

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
    stuckSessions: number;
    systemHealthPct: number;
  };
  weeklyTrend: SessionTrendPoint[];
  monthlyTrend: SessionTrendPoint[];
  yearlyTrend: SessionTrendPoint[];
  topDomains: TopicDomainRow[];
  topDomainsWeekly?: TopicPeriodData;
  topDomainsMonthly?: TopicPeriodData;
  topDomainsYearly?: TopicPeriodData;
  recentSessions: Array<{
    id: string;
    type: string;
    name: string;
    email: string;
    company: string;
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
  warning:
    "border-amber-200/80 bg-amber-50/90 text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-200",
  critical:
    "border-red-200/80 bg-red-50/90 text-red-900 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-200",
};

const STATUS_STYLES: Record<string, string> = {
  LIVE: "bg-red-50 text-red-700 ring-1 ring-red-200/70 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/30",
  READY: "bg-sky-50 text-sky-700 ring-1 ring-sky-200/70 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/30",
  COMPLETED:
    "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30",
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

const TOPIC_ACRONYMS = new Set(["hr", "it", "qa", "ui", "ux", "ai", "ml", "sde"]);

function formatPersonName(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(" ");
}

function formatInterviewTopic(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\banaytics\b/gi, "analytics")
    .split(" ")
    .map((word) => {
      const core = word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");
      if (!core) return word;
      const lower = core.toLowerCase();
      const formatted = TOPIC_ACRONYMS.has(lower)
        ? lower.toUpperCase()
        : lower.charAt(0).toUpperCase() + lower.slice(1);
      return word.replace(core, formatted);
    })
    .join(" ");
}

function sessionTypeLabel(type: string) {
  if (type === "COMPANY") return "Company";
  if (type === "PRACTICE") return "Practice";
  return type;
}

function sessionStatusLabel(status: string) {
  if (status === "LIVE") return "Live";
  if (status === "READY") return "Ready";
  if (status === "COMPLETED") return "Completed";
  return status;
}

const QUICK_LINKS = [
  { href: "/master/companies", label: "Companies", icon: Building2 },
  { href: "/master/practice-sessions", label: "Practice Interviews", icon: ScrollText },
  { href: "/master/payments", label: "Payments", icon: CreditCard },
  { href: "/master/support", label: "Support", icon: LifeBuoy },
  { href: "/master/security", label: "Security", icon: Shield },
  { href: "/master/reports", label: "Reports", icon: TrendingUp },
  { href: "/master/promo-codes", label: "Promo Codes", icon: TicketPercent },
  { href: "/master/user-analytics", label: "Users", icon: Users },
];

const CHART_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#06b6d4"];

const CHART_PERIOD_OPTIONS: Array<{
  id: ChartPeriod;
  label: string;
  title: string;
  subtitle: string;
}> = [
  {
    id: "weekly",
    label: "Weekly",
    title: "Interviews in last 7 days",
    subtitle: "Practice vs company interviews each day",
  },
  {
    id: "monthly",
    label: "Monthly",
    title: "Interviews in last 12 months",
    subtitle: "Practice vs company interviews each month",
  },
  {
    id: "yearly",
    label: "Yearly",
    title: "Interviews in last 5 years",
    subtitle: "Practice vs company interviews each year",
  },
];

const TOPIC_PERIOD_OPTIONS: Array<{
  id: ChartPeriod;
  label: string;
  subtitle: string;
  rangeLabel: string;
}> = [
  { id: "weekly", label: "Week", subtitle: "Last 7 days", rangeLabel: "this week" },
  { id: "monthly", label: "Month", subtitle: "Last 12 months", rangeLabel: "in last 12 months" },
  { id: "yearly", label: "Year", subtitle: "Last 5 years", rangeLabel: "in last 5 years" },
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
  const yMax = Math.max(1, maxTotal);
  const yTicks = [...new Set([yMax, Math.round(yMax / 2), 0])];
  const periodTotal = points.reduce((sum, point) => sum + point.total, 0);

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <div className="text-muted-foreground flex h-32 w-6 shrink-0 flex-col justify-between pt-4 text-right text-[10px] font-medium tabular-nums">
          {yTicks.map((tick, i) => (
            <span key={`trend-ytick-${i}-${tick}`}>{tick}</span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative h-32">
            <div className="absolute inset-x-0 top-4 bottom-0">
              {yTicks.map((tick, i) => (
                <div
                  key={`trend-grid-${i}-${tick}`}
                  className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-border"
                  style={{ bottom: `${(tick / yMax) * 100}%` }}
                />
              ))}
              <div className="absolute inset-0 flex items-end gap-1.5">
                {points.map((point) => {
                  const pointKey = `${period}-${point.label}`;
                  const isActive = activeKey === pointKey;
                  const heightPct = (point.total / yMax) * 100;

                  return (
                    <button
                      key={pointKey}
                      type="button"
                      className="relative flex h-full min-w-0 flex-1 items-end justify-center"
                      onMouseEnter={() => setHoveredKey(pointKey)}
                      onMouseLeave={() => setHoveredKey(null)}
                      onClick={() => setPinnedKey((current) => (current === pointKey ? null : pointKey))}
                      aria-label={`${point.label}: ${point.total} interviews`}
                      aria-pressed={pinnedKey === pointKey}
                    >
                      {isActive ? (
                        <div className="admin-chart-tooltip pointer-events-none absolute top-0 left-1/2 z-10 min-w-[8.5rem] -translate-x-1/2">
                          <p className="text-xs font-bold text-foreground">{point.label}</p>
                          <div className="mt-1.5 space-y-1">
                            <p className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-sm" style={{ background: CHART_COLORS[1] }} />
                                Practice
                              </span>
                              <span className="font-bold text-foreground">{point.practice}</span>
                            </p>
                            <p className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-sm" style={{ background: CHART_COLORS[0] }} />
                                Company
                              </span>
                              <span className="font-bold text-foreground">{point.company}</span>
                            </p>
                            <p className="flex items-center justify-between gap-3 border-t border-border pt-1 text-[11px] text-muted-foreground">
                              <span>Total</span>
                              <span className="font-bold text-foreground">{point.total}</span>
                            </p>
                          </div>
                        </div>
                      ) : null}
                      <div
                        className={`relative w-full overflow-hidden rounded-t-md ${
                          isActive ? "ring-1 ring-primary/40" : ""
                        }`}
                        style={{ height: point.total > 0 ? `${Math.max(14, heightPct)}%` : "3px" }}
                      >
                        {point.total > 0 ? (
                          <div className="flex h-full w-full flex-col justify-end">
                            {point.practice > 0 ? (
                              <div
                                style={{
                                  height: `${(point.practice / point.total) * 100}%`,
                                  background: CHART_COLORS[1],
                                }}
                              />
                            ) : null}
                            {point.company > 0 ? (
                              <div
                                style={{
                                  height: `${(point.company / point.total) * 100}%`,
                                  background: CHART_COLORS[0],
                                }}
                              />
                            ) : null}
                          </div>
                        ) : (
                          <div className="h-full w-full rounded-sm bg-muted" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div
            className="mt-1.5 grid gap-1 text-center"
            style={{ gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(0, 1fr))` }}
          >
            {points.map((point) => (
              <div key={`${period}-${point.label}-xlabel`}>
                <p className="truncate text-[10px] font-semibold text-muted-foreground">{point.label}</p>
                <p className="text-[10px] font-bold tabular-nums text-foreground">{point.total}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {activePoint ? (
          <>
            <span className="font-semibold text-foreground">{activePoint.label}</span>
            {" · "}
            Practice {activePoint.practice}
            {" · "}
            Company {activePoint.company}
          </>
        ) : periodTotal === 0 ? (
          "No interviews in this period"
        ) : (
          `${periodTotal} interview${periodTotal === 1 ? "" : "s"} in this period · hover a bar for split`
        )}
      </p>
    </div>
  );
}

function DonutChart({
  segments,
  centerLabel,
  centerValue,
  size = 132,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  centerLabel: string;
  centerValue: string | number;
  size?: number;
}) {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0) || 1;
  const r = 36;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="currentColor"
            className="text-slate-200 dark:text-white/10"
            strokeWidth="14"
          />
          {segments.map((seg) => {
            const dash = (seg.value / total) * c;
            const el = (
              <circle
                key={seg.label}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth="14"
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            );
            offset += dash;
            return el;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2">
          <p className="text-xl font-black tabular-nums text-foreground">{centerValue}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{centerLabel}</p>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: seg.color }} />
              <span className="truncate font-semibold text-foreground">{seg.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              <span className="font-bold text-foreground">{seg.value}</span>
              {" · "}
              {Math.round((seg.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopicBarChart({
  rows,
  periodTotal,
  periodLabel,
}: {
  rows: Array<{ label: string; value: number; color: string }>;
  periodTotal: number;
  periodLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (rows.length === 0) {
    return (
      <div className="flex h-full min-h-[8rem] items-center justify-center">
        <p className="text-sm text-muted-foreground">No interview topics in this period.</p>
      </div>
    );
  }

  const maxVal = Math.max(1, ...rows.map((row) => row.value));
  const yTicks = [...new Set([maxVal, Math.round(maxVal / 2), 0])];
  const shownTotal = rows.reduce((sum, row) => sum + row.value, 0);
  const shareBase = periodTotal > 0 ? periodTotal : shownTotal;
  const lead = rows[0];
  const leadPct = shareBase > 0 ? Math.round((lead.value / shareBase) * 100) : 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-[9.5rem] flex-1 gap-1.5">
        <div className="text-muted-foreground flex w-6 shrink-0 flex-col justify-between pt-4 text-right text-[10px] font-medium tabular-nums">
          {yTicks.map((tick, i) => (
            <span key={`topic-ytick-${i}-${tick}`}>{tick}</span>
          ))}
        </div>
        <div className="relative min-h-0 min-w-0 flex-1">
          <div className="absolute inset-x-0 top-4 bottom-0">
            {yTicks.map((tick, i) => (
              <div
                key={`topic-grid-${i}-${tick}`}
                className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-border"
                style={{ bottom: `${(tick / maxVal) * 100}%` }}
              />
            ))}
            <div className="absolute inset-0 flex items-end gap-1.5">
              {rows.map((row, i) => {
                const heightPct = (row.value / maxVal) * 100;
                const pct = shareBase > 0 ? Math.round((row.value / shareBase) * 100) : 0;
                const isHover = hover === i;
                return (
                  <div
                    key={row.label}
                    className="relative flex h-full min-w-0 flex-1 items-end justify-center"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  >
                    {isHover ? (
                      <div className="admin-chart-tooltip pointer-events-none absolute top-0 left-1/2 z-10 min-w-[8.5rem] -translate-x-1/2">
                        <p className="text-[11px] font-semibold text-muted-foreground">{row.label}</p>
                        <p className="mt-1 text-xs font-bold text-foreground">
                          {row.value} · {pct}%
                        </p>
                      </div>
                    ) : null}
                    <div
                      className="relative w-full"
                      style={{ height: `${Math.max(row.value > 0 ? 8 : 2, heightPct)}%` }}
                    >
                      <span
                        className={`absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold tabular-nums ${
                          isHover ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {row.value}
                      </span>
                      <div
                        className="h-full w-full rounded-t-md"
                        style={{ background: row.color, opacity: isHover ? 1 : 0.92 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div
        className="mt-1.5 grid gap-1 text-center"
        style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}
      >
        {rows.map((row) => (
          <span
            key={`${row.label}-xlabel`}
            className="truncate text-[9px] font-semibold leading-tight text-muted-foreground"
            title={row.label}
          >
            {row.label}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">{lead.label}</span>
        {" · "}
        {leadPct}% of {shareBase} interview{shareBase === 1 ? "" : "s"} {periodLabel}
      </p>
      <div className="mt-1.5 space-y-1">
        {rows.map((row) => {
          const pct = shareBase > 0 ? Math.round((row.value / shareBase) * 100) : 0;
          return (
            <div key={`${row.label}-share`} className="flex items-center gap-2">
              <span className="w-[42%] truncate text-[10px] font-semibold text-foreground" title={row.label}>
                {row.label}
              </span>
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(pct > 0 ? 4 : 0, pct)}%`, background: row.color }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-[10px] font-bold tabular-nums text-muted-foreground">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
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
    <article className="admin-card flex flex-col gap-1 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${accent}`}>
          <Icon className="h-3 w-3" />
        </div>
      </div>
      <p className="text-xl font-black tracking-tight text-foreground">{value}</p>
      <p className="text-[10px] leading-snug text-muted-foreground">{hint}</p>
    </article>
  );
}

export default function MasterDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("weekly");
  const [topicPeriod, setTopicPeriod] = useState<ChartPeriod>("yearly");

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
    } catch {
      setError("Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpiCards = useMemo(() => {
    const metrics = data?.metrics;
    return [
      {
        label: "Total companies",
        value: metrics?.totalCompanies ?? 0,
        hint: `${metrics?.activeCompanies ?? 0} active · ${metrics?.newCompanies30d ?? 0} new in last 30 days`,
        icon: Building2,
        accent: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
      },
      {
        label: "Total interviews",
        value: metrics?.totalSessions ?? 0,
        hint: `${metrics?.sessionsLast30d ?? 0} in last 30 days`,
        icon: ScrollText,
        accent: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
      },
      {
        label: "Practice revenue",
        value: inrFormatter.format(metrics?.practiceRevenue ?? 0),
        hint: `${inrFormatter.format(metrics?.revenueLast30d ?? 0)} in last 30 days`,
        icon: CreditCard,
        accent: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
      },
      {
        label: "Live interviews",
        value: metrics?.liveSessions ?? 0,
        hint: `${metrics?.readySessions ?? 0} waiting to start · ${metrics?.completedSessions ?? 0} completed`,
        icon: Activity,
        accent: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
      },
      {
        label: "Completion rate",
        value: `${metrics?.completionRatePct ?? 0}%`,
        hint: "Share of interviews that finished",
        icon: TrendingUp,
        accent: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
      },
      {
        label: "Paying users",
        value: metrics?.uniquePayingUsers ?? 0,
        hint: "Candidates who paid for practice interviews",
        icon: Users,
        accent: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
      },
      {
        label: "Promo codes",
        value: metrics?.promoCodesActive ?? 0,
        hint: `${metrics?.promoRedemptions30d ?? 0} used in last 30 days`,
        icon: TicketPercent,
        accent: "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300",
      },
      {
        label: "Stuck interviews",
        value: metrics?.stuckSessions ?? 0,
        hint: `Older than 1 hour · ${metrics?.supportNew ?? 0} new tickets`,
        icon: AlertTriangle,
        accent: "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300",
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
  const activeTopicPeriod =
    TOPIC_PERIOD_OPTIONS.find((option) => option.id === topicPeriod) ?? TOPIC_PERIOD_OPTIONS[2];
  const topicPeriodData = useMemo(() => {
    if (!data) return { total: 0, rows: [] as TopicDomainRow[] };
    if (topicPeriod === "weekly") return data.topDomainsWeekly ?? { total: 0, rows: [] };
    if (topicPeriod === "monthly") return data.topDomainsMonthly ?? { total: 0, rows: [] };
    if (data.topDomainsYearly) return data.topDomainsYearly;
    return {
      total: data.topDomains.reduce((sum, row) => sum + row.sessions, 0),
      rows: data.topDomains,
    };
  }, [data, topicPeriod]);
  const recentSessions = (data?.recentSessions ?? []).slice(0, 6);
  const recentCompanies = (data?.recentCompanies ?? []).slice(0, 6);
  const metrics = data?.metrics;
  const maxCompanySessions = Math.max(1, ...recentCompanies.map((row) => row.sessionCount));

  return (
    <MasterShell
      title="Dashboard"
      subtitle="See companies, interviews, payments, and support in one place."
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
        <div className="rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-700 shadow-sm dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        {data?.alerts.length ? (
          <section className="space-y-2">
            {data.alerts.map((alert) =>
              alert.level === "info" ? (
                <div key={alert.id} className="admin-alert-banner">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">{alert.title}</p>
                  </div>
                  {alert.href ? (
                    <Link
                      href={alert.href}
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 transition hover:text-emerald-600 dark:text-emerald-300"
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
            <div className="admin-card p-5">
              <p className="text-muted-foreground text-sm">Loading dashboard…</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div key={n} className="admin-card h-[72px] animate-pulse bg-muted" />
              ))}
            </div>
          </>
        ) : (
          <>
            <section className="admin-card p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold tracking-tight">Platform overview</h2>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {metrics?.activeCompanies ?? 0} active companies · {metrics?.liveSessions ?? 0} live ·{" "}
                    {inrFormatter.format(metrics?.practiceRevenue ?? 0)} revenue
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href="/master/practice-sessions" className="admin-btn-ghost px-3 py-1.5 text-xs no-underline">
                    Practice interviews
                  </Link>
                  <Link href="/master/companies" className="admin-btn-primary px-3 py-1.5 text-xs no-underline">
                    Manage companies
                  </Link>
                </div>
              </div>
            </section>

            <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
                    <Icon className={`h-3.5 w-3.5 ${isActive ? "text-current" : "text-muted-foreground"}`} />
                    {link.label}
                  </Link>
                );
              })}
            </section>

            <section className="grid items-stretch gap-3 xl:grid-cols-3">
              <div className="admin-card-elevated flex h-full min-w-0 flex-col p-3">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="admin-section-title text-sm">{activeChartPeriod.title}</p>
                    <p className="text-[11px] text-muted-foreground">{activeChartPeriod.subtitle}</p>
                    <div className="mt-1.5 flex gap-3 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm" style={{ background: CHART_COLORS[0] }} /> Company
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm" style={{ background: CHART_COLORS[1] }} /> Practice
                      </span>
                    </div>
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
                <div className="mt-auto min-h-0 flex-1">
                  <SessionTrendChart points={chartTrend} period={chartPeriod} maxTotal={maxChartTotal} />
                </div>
              </div>

              <div className="admin-card flex h-full min-w-0 flex-col p-3">
                <p className="admin-section-title text-sm">Interview types</p>
                <p className="mb-2 text-[11px] text-muted-foreground">Practice vs company split</p>
                <div className="mt-auto">
                  <DonutChart
                    size={112}
                    centerValue={(metrics?.companySessions ?? 0) + (metrics?.practiceSessions ?? 0)}
                    centerLabel="Total"
                    segments={[
                      {
                        label: "Company",
                        value: metrics?.companySessions ?? 0,
                        color: "#3b82f6",
                      },
                      {
                        label: "Practice",
                        value: metrics?.practiceSessions ?? 0,
                        color: "#10b981",
                      },
                    ]}
                  />
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {[
                      { label: "Done", value: metrics?.completedSessions ?? 0, color: "#10b981" },
                      { label: "Live", value: metrics?.liveSessions ?? 0, color: "#ef4444" },
                      { label: "Waiting", value: metrics?.readySessions ?? 0, color: "#3b82f6" },
                    ].map((row) => (
                      <div key={row.label} className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
                        <p className="text-xs font-bold tabular-nums text-foreground">{row.value}</p>
                        <p className="text-[10px] text-muted-foreground">{row.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="admin-card flex h-full min-w-0 flex-col p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="admin-section-title text-sm">Top interview topics</p>
                    <p className="text-[11px] text-muted-foreground">{activeTopicPeriod.subtitle}</p>
                  </div>
                  <MasterSelect
                    size="sm"
                    aria-label="Topic period"
                    className="!h-7 !min-h-7 w-[5.75rem] !px-2 !py-0 !text-[11px] !font-semibold"
                    value={topicPeriod}
                    onValueChange={(value) => setTopicPeriod(value as ChartPeriod)}
                    options={TOPIC_PERIOD_OPTIONS.map((option) => ({
                      value: option.id,
                      label: option.label,
                    }))}
                  />
                </div>
                <div className="min-h-0 flex-1">
                  <TopicBarChart
                    periodTotal={topicPeriodData.total}
                    periodLabel={activeTopicPeriod.rangeLabel}
                    rows={topicPeriodData.rows.map((row, index) => ({
                      label: formatInterviewTopic(row.domain),
                      value: row.sessions,
                      color: CHART_COLORS[index % CHART_COLORS.length],
                    }))}
                  />
                </div>
              </div>
            </section>

            <section className="grid items-stretch gap-3 lg:grid-cols-2">
              <div className="admin-card-elevated flex h-full min-w-0 flex-col p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="admin-section-title text-sm">Recent interviews</p>
                  <Link
                    href="/master/practice-sessions"
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 transition hover:text-emerald-600 dark:text-emerald-300"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View all
                  </Link>
                </div>
                <div className="min-h-0 flex-1 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                        <th className="py-1.5 pr-3">Candidate</th>
                        <th className="pr-3">Type</th>
                        <th className="pr-3">Company</th>
                        <th className="pr-3">Status</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSessions.map((session) => (
                        <tr key={session.id} className="border-b border-border last:border-0 transition hover:bg-muted/50">
                          <td className="py-1.5 pr-3">
                            <p className="truncate font-semibold text-foreground">{formatPersonName(session.name)}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{formatInterviewTopic(session.domain)}</p>
                          </td>
                          <td className="pr-3">
                            <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground ring-1 ring-border">
                              {sessionTypeLabel(session.type)}
                            </span>
                          </td>
                          <td className="max-w-[8.5rem] truncate pr-3 text-[11px] font-semibold text-foreground" title={session.company || undefined}>
                            {session.company || "—"}
                          </td>
                          <td className="pr-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[session.status] ?? "bg-muted text-muted-foreground ring-1 ring-border"}`}
                            >
                              {session.status === "LIVE" ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              ) : null}
                              {sessionStatusLabel(session.status)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap text-[11px] text-muted-foreground">
                            {formatSessionDate(session.createdAt)}
                          </td>
                        </tr>
                      ))}
                      {!recentSessions.length ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-sm text-muted-foreground">
                            No interviews yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="admin-card-elevated flex h-full min-w-0 flex-col p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="admin-section-title text-sm">Recent companies</p>
                  <Link
                    href="/master/companies"
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 transition hover:text-emerald-600 dark:text-emerald-300"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View all
                  </Link>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-1.5">
                  {recentCompanies.map((company) => (
                    <div
                      key={company.id}
                      className="flex flex-1 flex-col justify-center rounded-lg border border-border bg-muted/30 px-2.5 py-1.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e293b] text-[11px] font-bold text-white">
                            {companyInitial(company.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{company.name}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{company.domain}</p>
                          </div>
                        </div>
                        <p className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
                          <span className="font-bold text-foreground">{company.sessionCount}</span>
                        </p>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${Math.max(company.sessionCount > 0 ? 6 : 0, (company.sessionCount / maxCompanySessions) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {!recentCompanies.length ? (
                    <p className="text-sm text-muted-foreground">No companies onboarded yet.</p>
                  ) : null}
                </div>
              </div>
            </section>

            {data?.generatedAt ? (
              <p className="text-center text-xs text-muted-foreground">
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
