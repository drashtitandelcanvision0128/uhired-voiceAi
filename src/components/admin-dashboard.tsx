"use client";

import {
  AlertTriangle,
  ArrowRight,
  Award,
  Clock,
  Copy,
  Minus,
  Search,
  Star,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppSelect } from "@/components/ui/app-select";

export type DashboardPeriod = "7d" | "30d" | "month" | "year";

export type DashboardData = {
  period: DashboardPeriod;
  periodLabel: string;
  range: { start: string; end: string };
  statusCounts: {
    total: number;
    ready: number;
    live: number;
    completed: number;
    open: number;
  };
  periodCounts: {
    total: number;
    ready: number;
    live: number;
    completed: number;
    open: number;
  };
  candidatesCount: number;
  newCandidatesInPeriod: number;
  requirementsCount: number;
  invites: {
    total: number;
    sent: number;
    used: number;
    pending: number;
  };
  periodInvites: {
    total: number;
    sent: number;
    used: number;
    pending: number;
    conversionRate: number;
  };
  averageScore: number | null;
  prevAverageScore: number | null;
  completionRate: number;
  utilizationRate: number;
  scoreBuckets: Array<{ label: string; count: number }>;
  sessionsTrend: Array<{ date: string; label: string; created: number; completed: number }>;
  comparisons: {
    sessionsCreated: { current: number; previous: number; deltaPct: number | null };
    invitesSent: { current: number; previous: number; deltaPct: number | null };
    averageScore: { current: number | null; previous: number | null; deltaPct: number | null };
  };
  topRoles: Array<{ role: string; count: number; avgScore: number | null }>;
  recentSessions: Array<{
    id: string;
    candidateName: string | null;
    positionTitle: string | null;
    domain: string;
    status: string;
    createdAt: string;
    candidateInviteCode?: string | null;
    requirementAccessCode?: string | null;
    scorecard: { overallScore: number } | null;
    interviewDurationDisplay?: string;
  }>;
};

type AdminDashboardProps = {
  companyName: string;
  data: DashboardData | null;
  loading: boolean;
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
  onNavigate: (section: string) => void;
  onOpenSession: (sessionId: string) => void;
  formatSessionCode: (session: DashboardData["recentSessions"][number]) => string;
  formatRelativeTime: (iso: string) => string;
};

const CHART_PERIOD_TABS: Array<{ key: DashboardPeriod; label: string }> = [
  { key: "year", label: "Last 3 months" },
  { key: "30d", label: "Last 30 days" },
  { key: "7d", label: "Last 7 days" },
];

const CHART_COLORS = ["#171717", "#737373", "#a3a3a3", "#d4d4d4", "#525252"];

function getInitials(name: string | null) {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function trendCopy(delta: number | null, up: string, down: string, flat = "Holding steady") {
  if (delta == null) return flat;
  if (delta > 0) return up;
  if (delta < 0) return down;
  return flat;
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value == null) return null;
  if (value === 0) {
    return (
      <Badge variant="secondary">
        <Minus />
        0%
      </Badge>
    );
  }
  const up = value > 0;
  return (
    <Badge variant={up ? "success" : "danger"}>
      {up ? <TrendingUp /> : <TrendingDown />}
      {up ? "+" : ""}
      {value}%
    </Badge>
  );
}

function niceMax(raw: number) {
  if (raw <= 1) return 1;
  const padded = raw * 1.15;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return Math.ceil(nice * magnitude);
}

function AreaLineChart({
  data,
}: {
  data: Array<{ label: string; created: number; completed: number }>;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 100;
  const height = 100;
  const dataMax = Math.max(1, ...data.flatMap((d) => [d.created, d.completed]));
  const maxVal = niceMax(dataMax);
  const mid = Math.round(maxVal / 2);
  const yTicks = [...new Set([maxVal, mid, 0])];

  const xPos = (i: number) => (i / Math.max(data.length - 1, 1)) * width;
  const yPos = (v: number) => {
    const clamped = Math.min(Math.max(v, 0), maxVal);
    return height - (clamped / maxVal) * height;
  };

  const toPath = (key: "created" | "completed") =>
    data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${xPos(i).toFixed(2)} ${yPos(d[key]).toFixed(2)}`)
      .join(" ");

  const createdArea = `${toPath("created")} L ${xPos(data.length - 1).toFixed(2)} ${height} L ${xPos(0).toFixed(2)} ${height} Z`;
  const completedArea = `${toPath("completed")} L ${xPos(data.length - 1).toFixed(2)} ${height} L ${xPos(0).toFixed(2)} ${height} Z`;
  const tip = hover != null ? data[hover] : null;
  const clipId = "session-activity-clip";
  const xLabels = data.map((d, i) => (data.length > 14 && i % 2 !== 0 ? "" : d.label));

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <div className="text-muted-foreground flex h-36 w-7 shrink-0 flex-col justify-between py-0.5 text-right text-[11px] font-medium tabular-nums sm:h-40 sm:text-xs">
          {yTicks.map((tick, tickIndex) => (
            <span key={`ytick-${tickIndex}-${tick}`}>{tick}</span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative h-36 w-full sm:h-40">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-full w-full"
              preserveAspectRatio="none"
              onMouseLeave={() => setHover(null)}
            >
              <defs>
                <linearGradient id="areaGradCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="areaGradCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
                <clipPath id={clipId}>
                  <rect x="0" y="0" width={width} height={height} />
                </clipPath>
              </defs>
              {yTicks.map((tick, tickIndex) => (
                <line
                  key={`grid-${tickIndex}-${tick}`}
                  x1="0"
                  x2={width}
                  y1={yPos(tick)}
                  y2={yPos(tick)}
                  stroke="currentColor"
                  className="text-border"
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <g clipPath={`url(#${clipId})`} className="text-foreground">
                <path d={createdArea} fill="url(#areaGradCreated)" />
                <path d={completedArea} fill="url(#areaGradCompleted)" className="text-muted-foreground" />
                <path
                  d={toPath("created")}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={toPath("completed")}
                  fill="none"
                  stroke="currentColor"
                  className="text-muted-foreground"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                {data.map((d, i) => (
                  <rect
                    key={`pt-${i}`}
                    x={xPos(i) - width / data.length / 2}
                    y="0"
                    width={Math.max(2, width / data.length)}
                    height={height}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                  />
                ))}
              </g>
            </svg>
            {tip && hover != null ? (
              <>
                <span
                  className="bg-foreground pointer-events-none absolute z-10 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    left: `${(xPos(hover) / width) * 100}%`,
                    top: `${(yPos(tip.created) / height) * 100}%`,
                  }}
                />
                <span
                  className="bg-muted-foreground pointer-events-none absolute z-10 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    left: `${(xPos(hover) / width) * 100}%`,
                    top: `${(yPos(tip.completed) / height) * 100}%`,
                  }}
                />
                <div
                  className="admin-chart-tooltip pointer-events-none absolute z-10 min-w-[140px] -translate-x-1/2"
                  style={{
                    left: `${(xPos(hover) / width) * 100}%`,
                    top: 8,
                  }}
                >
                  <p className="text-muted-foreground text-[11px] font-semibold">{tip.label}</p>
                  <p className="mt-1 text-xs font-medium text-foreground">New: {tip.created}</p>
                  <p className="text-muted-foreground text-xs">Completed: {tip.completed}</p>
                </div>
              </>
            ) : null}
          </div>
          <div
            className="text-muted-foreground mt-1.5 grid text-center text-[11px] font-medium sm:text-xs"
            style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
          >
            {xLabels.map((label, i) => (
              <span key={`xlabel-${i}`} className="truncate">
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="text-muted-foreground mt-3 flex items-center justify-center gap-5 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="bg-foreground h-0.5 w-4 rounded" /> New Sessions
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-muted-foreground h-0.5 w-4 rounded" /> Completed
        </span>
      </div>
    </div>
  );
}

function DonutChart({
  segments,
  centerLabel,
  centerValue,
  size = 148,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  centerLabel: string;
  centerValue: string | number;
  size?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const r = 38;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex min-w-0 flex-col items-center gap-4 overflow-hidden">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="currentColor"
            className="text-slate-100 dark:text-white/8"
            strokeWidth="12"
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
                strokeWidth="12"
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
          <p className="text-2xl font-black tabular-nums text-[#0f172a] dark:text-white">{centerValue}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{centerLabel}</p>
        </div>
      </div>

      <div className="w-full min-w-0 space-y-2">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-xs"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: seg.color }}
              />
              <span className="truncate font-semibold text-slate-600 dark:text-slate-300">
                {seg.label}
              </span>
            </div>
            <span className="shrink-0 whitespace-nowrap text-right tabular-nums">
              <span className="font-bold text-[#0f172a] dark:text-white">{seg.value}</span>
              <span className="ml-1 text-slate-400">
                ({Math.round((seg.value / total) * 100)}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreBarChart({ buckets }: { buckets: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <div className="space-y-3.5">
      {buckets.map((b, i) => (
        <div key={b.label}>
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-300">{b.label}</span>
            <span className="text-slate-500">
              {b.count} ({total > 0 ? Math.round((b.count / total) * 100) : 0}%)
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/8">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(b.count / max) * 100}%`,
                background: CHART_COLORS[i % CHART_COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
      <p className="pt-1 text-center text-[10px] font-semibold text-slate-400">
        {total} scored interview{total !== 1 ? "s" : ""} in period
      </p>
    </div>
  );
}

const PROGRESS_BAR_SHORT_LABELS: Record<string, string> = {
  "Invites Created": "Created",
  "Emails Sent": "Sent",
  "Interview Started": "Started",
  "Not Started Yet": "Pending",
};

function ProgressBarChart({
  steps,
}: {
  steps: Array<{ label: string; value: number; color: string }>;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const dataMax = Math.max(0, ...steps.map((s) => s.value));
  const maxVal = niceMax(Math.max(1, dataMax));
  const yTicks = [...new Set([maxVal, Math.round(maxVal / 2), 0])];
  const baseline = steps[0]?.value ?? 0;

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <div className="text-muted-foreground flex h-44 w-7 shrink-0 flex-col justify-between pt-5 text-right text-[11px] font-medium tabular-nums">
          {yTicks.map((tick, tickIndex) => (
            <span key={`progress-ytick-${tickIndex}-${tick}`}>{tick}</span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative h-44">
            <div className="absolute inset-x-0 top-5 bottom-0">
              {yTicks.map((tick, tickIndex) => (
                <div
                  key={`progress-grid-${tickIndex}-${tick}`}
                  className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-slate-200 dark:border-white/10"
                  style={{ bottom: `${(tick / maxVal) * 100}%` }}
                />
              ))}
              <div className="absolute inset-0 flex items-end justify-around gap-1 px-0.5">
                {steps.map((step, i) => {
                  const heightPct = maxVal > 0 ? (step.value / maxVal) * 100 : 0;
                  const ofCreated = baseline > 0 ? Math.round((step.value / baseline) * 100) : 0;
                  const isHover = hover === i;
                  return (
                    <div
                      key={step.label}
                      className="relative flex h-full min-w-0 flex-1 items-end justify-center"
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                    >
                      {isHover ? (
                        <div className="admin-chart-tooltip pointer-events-none absolute top-0 left-1/2 z-10 min-w-[8.75rem] -translate-x-1/2">
                          <p className="text-[11px] font-semibold text-muted-foreground">{step.label}</p>
                          <p className="mt-1 text-xs font-bold text-foreground">{step.value}</p>
                          <p className="text-[11px] text-muted-foreground">{ofCreated}% of invites created</p>
                        </div>
                      ) : null}
                      <div
                        className="relative w-[72%] max-w-[2.35rem] transition-all"
                        style={{ height: `${Math.max(step.value > 0 ? 6 : 2, heightPct)}%` }}
                      >
                        <span
                          className={`absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold tabular-nums ${
                            isHover ? "text-foreground" : "text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {step.value}
                        </span>
                        <div
                          className="h-full w-full rounded-t-md"
                          style={{
                            background: step.color,
                            opacity: isHover ? 1 : 0.9,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1 text-center">
            {steps.map((step) => (
              <span
                key={`${step.label}-xlabel`}
                className="truncate text-[10px] font-semibold leading-tight text-slate-500"
              >
                {PROGRESS_BAR_SHORT_LABELS[step.label] ?? step.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {steps.map((step) => (
          <div key={`${step.label}-legend`} className="flex min-w-0 items-center gap-1.5 text-[10px]">
            <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: step.color }} />
            <span className="truncate font-semibold text-slate-500 dark:text-slate-400">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchBar({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="text-xs font-semibold text-slate-400">—</span>;
  }
  const color =
    score >= 75 ? "#34d399" : score >= 50 ? "#fbbf24" : score >= 30 ? "#fb923c" : "#f87171";
  return (
    <div className="flex min-w-[100px] items-center gap-2">
      <span className="w-9 text-xs font-bold tabular-nums text-[#0f172a] dark:text-white">{score}%</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "COMPLETED") {
    return (
      <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-400 dark:ring-emerald-500/25">
        Completed
      </span>
    );
  }
  if (status === "LIVE") {
    return (
      <span className="inline-flex rounded-full bg-sky-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-700 ring-1 ring-sky-500/30 dark:text-sky-400 dark:ring-sky-500/25">
        Live
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-violet-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-700 ring-1 ring-violet-500/30 dark:text-violet-300 dark:ring-violet-500/25">
      Ready
    </span>
  );
}

function AvatarTone(name: string | null) {
  const tones = [
    "from-sky-500 to-cyan-400",
    "from-violet-500 to-fuchsia-400",
    "from-emerald-500 to-teal-400",
    "from-amber-500 to-orange-400",
    "from-rose-500 to-pink-400",
  ];
  const idx = (name ?? "?").charCodeAt(0) % tones.length;
  return tones[idx];
}

export function AdminDashboard({
  companyName,
  data,
  period,
  onPeriodChange,
  onNavigate,
  onOpenSession,
  formatSessionCode,
  formatRelativeTime,
}: AdminDashboardProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sessionSearch, setSessionSearch] = useState("");
  const [sessionStatus, setSessionStatus] = useState("ALL");

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="admin-card h-32 animate-pulse bg-muted" />
          ))}
        </div>
        <div className="admin-card h-72 animate-pulse bg-muted" />
      </div>
    );
  }

  const { statusCounts, periodCounts, invites, periodInvites, comparisons } = data;
  const isFirstRun =
    statusCounts.total === 0 &&
    data.candidatesCount === 0 &&
    data.requirementsCount === 0 &&
    invites.total === 0;
  const sessionQuery = sessionSearch.trim().toLowerCase();
  const filteredRecentSessions = data.recentSessions.filter((session) => {
    if (sessionStatus !== "ALL" && session.status !== sessionStatus) return false;
    if (!sessionQuery) return true;
    const haystack = [
      session.candidateName,
      session.positionTitle,
      session.domain,
      formatSessionCode(session),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(sessionQuery);
  });

  const statusSegments = [
    { label: "Completed", value: statusCounts.completed, color: "#2dd4bf" },
    { label: "Ready", value: statusCounts.ready, color: "#a78bfa" },
    { label: "Live", value: statusCounts.live, color: "#38bdf8" },
  ].filter((s) => s.value > 0);
  const pendingInviteSegments = [
    { label: "Not Attended Yet", value: invites.pending, color: "#f59e0b" },
    { label: "Attended", value: invites.used, color: "#14b8a6" },
  ].filter((s) => s.value > 0);

  const trendTotalCreated = data.sessionsTrend.reduce((s, d) => s + d.created, 0);
  const trendTotalCompleted = data.sessionsTrend.reduce((s, d) => s + d.completed, 0);

  const bestSession = [...data.recentSessions]
    .filter((s) => s.scorecard?.overallScore != null)
    .sort((a, b) => (b.scorecard?.overallScore ?? 0) - (a.scorecard?.overallScore ?? 0))[0];

  const mostActiveRole = data.topRoles[0];
  const dropOff =
    periodInvites.total > 0
      ? Math.round(((periodInvites.total - periodInvites.used) / periodInvites.total) * 100)
      : 0;

  const documentTabs = [
    { key: "sessions", label: "All Interviews", count: periodCounts.total },
    { key: "sessions", label: "Completed", count: periodCounts.completed },
    { key: "candidates", label: "Candidates", count: data.candidatesCount },
    { key: "requirements", label: "Job Openings", count: data.requirementsCount },
  ] as const;

  async function copyCode(sessionId: string, code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(sessionId);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-4 pb-4 sm:space-y-5">
      {isFirstRun ? (
        <section className="admin-card space-y-4 p-5 sm:p-6">
          <div className="space-y-2">
            <p className="text-primary text-[11px] font-bold uppercase tracking-[0.14em]">Start here</p>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Launch your first hiring workflow</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Create a job opening, add candidate emails, then send invites. Once candidates start
              interviewing, this dashboard will show progress, scores, and completion trends.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Create a job opening",
                body: "Add the role, job description, skills, and interview setup.",
              },
              {
                step: "2",
                title: "Invite candidates",
                body: "Paste emails or upload a sheet, then send interview invites.",
              },
              {
                step: "3",
                title: "Review interviews",
                body: "Track progress, open scorecards, and compare candidates.",
              },
            ].map((item) => (
              <div key={item.step} className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {item.step}
                </div>
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => onNavigate("overview")}>
              Create opening and invite
            </Button>
            <Button type="button" variant="outline" onClick={() => onNavigate("requirements")}>
              View job openings
            </Button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Interviews"
          value={statusCounts.total}
          delta={comparisons.sessionsCreated.deltaPct}
          trend={trendCopy(
            comparisons.sessionsCreated.deltaPct,
            `${periodCounts.total} interviews created this period`,
            `${periodCounts.total} interviews created this period`,
            `${periodCounts.total} interviews created this period`,
          )}
          footer={`${statusCounts.completed} completed · ${periodCounts.open} still in progress`}
          onClick={() => onNavigate("sessions")}
        />
        <MetricCard
          label="Total Candidates"
          value={data.candidatesCount}
          delta={data.newCandidatesInPeriod ? Math.round((data.newCandidatesInPeriod / Math.max(data.candidatesCount, 1)) * 100) : 0}
          trend={
            data.newCandidatesInPeriod > 0
              ? `+${data.newCandidatesInPeriod} new this period`
              : "No new candidates this period"
          }
          footer="Total candidates in your pipeline"
          onClick={() => onNavigate("candidates")}
        />
        <MetricCard
          label="Job Openings"
          value={data.requirementsCount}
          trend={data.requirementsCount > 0 ? "Roles ready for hiring" : "Create your first opening"}
          footer={`${data.requirementsCount} saved opening${data.requirementsCount === 1 ? "" : "s"}`}
          onClick={() => onNavigate("requirements")}
        />
        <MetricCard
          label="Pending Interviews"
          value={invites.pending}
          trend={
            invites.pending > 0
              ? `${invites.pending} candidates have not attended yet`
              : "No pending interviews"
          }
          footer={`${invites.used} attended · ${invites.sent} invites sent`}
        />
      </section>

      <Card className="shadow-none">
        <CardHeader className="flex flex-col gap-3 px-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <CardTitle className="text-base">Interviews Over Time</CardTitle>
            <CardDescription className="text-muted-foreground mt-1 text-sm">
              {data.periodLabel} — {trendTotalCreated} interviews created, {trendTotalCompleted} completed
            </CardDescription>
          </div>
          <div className="dashboard-chart-period w-full sm:w-auto" role="group" aria-label="Chart period">
            {CHART_PERIOD_TABS.map((tab) => {
              const active = period === tab.key || (tab.key === "30d" && period === "month");
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`dashboard-chart-period-btn flex-1 sm:flex-none ${active ? "is-active" : ""}`}
                  aria-pressed={active}
                  onClick={() => onPeriodChange(tab.key)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-4 sm:px-6">
          {data.sessionsTrend.some((d) => d.created > 0 || d.completed > 0) ? (
            <AreaLineChart data={data.sessionsTrend} />
          ) : (
            <div className="text-muted-foreground flex h-36 items-center justify-center rounded-xl bg-muted text-sm">
              No interview activity in this period yet.
            </div>
          )}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
          {documentTabs.map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => onNavigate(tab.key)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-background hover:text-foreground"
            >
              {tab.label}
              <span className="bg-background text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] tabular-nums">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="admin-btn-ghost text-xs" onClick={() => onNavigate("sessions")}>
            View all interviews
          </button>
          <button type="button" className="admin-btn-ghost text-xs" onClick={() => onNavigate("overview")}>
            Invite candidates
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="admin-card min-w-0 overflow-hidden p-5 xl:col-span-4">
          <div className="mb-4 flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="admin-section-title text-base">Interview Status</h3>
              <p className="truncate text-xs text-slate-500">{data.periodLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("sessions")}
              className="shrink-0 text-xs font-bold text-violet-400 hover:underline"
            >
              All interviews →
            </button>
          </div>
          {statusSegments.length > 0 ? (
            <DonutChart
              segments={statusSegments}
              centerValue={statusCounts.total}
              centerLabel="INTERVIEWS"
              size={132}
            />
          ) : (
            <p className="text-sm text-slate-500">No interviews yet.</p>
          )}
        </div>

        <div className="admin-card p-5 xl:col-span-4">
          <div className="mb-4">
            <h3 className="admin-section-title">Pending Interviews</h3>
            <p className="text-muted-foreground text-xs">
              {invites.sent} invites sent · {invites.used} attended · {invites.pending} not attended yet
            </p>
          </div>
          {pendingInviteSegments.length > 0 ? (
            <DonutChart
              segments={pendingInviteSegments}
              centerValue={invites.pending}
              centerLabel="PENDING"
              size={132}
            />
          ) : (
            <p className="mb-4 text-2xl font-semibold tabular-nums">0</p>
          )}
          <p className="text-muted-foreground mt-4 text-xs">
            Candidates who received an invite but have not started the interview yet
          </p>
        </div>

        <div className="admin-card p-5 xl:col-span-4">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h3 className="admin-section-title text-base">Interview Progress</h3>
              <p className="text-xs text-slate-500">{periodInvites.conversionRate}% started the interview</p>
            </div>
            <DeltaBadge value={comparisons.invitesSent.deltaPct} />
          </div>
          <ProgressBarChart
            steps={[
              { label: "Invites Created", value: periodInvites.total, color: "#7c3aed" },
              { label: "Emails Sent", value: periodInvites.sent, color: "#3b82f6" },
              { label: "Interview Started", value: periodInvites.used, color: "#14b8a6" },
              { label: "Not Started Yet", value: periodInvites.pending, color: "#f59e0b" },
            ]}
          />
        </div>
      </section>

      {/* Insights row */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="admin-card flex h-full flex-col p-5">
          <div className="mb-4">
            <h3 className="admin-section-title text-base">Candidate Scores</h3>
            <p className="text-xs text-slate-500">Score ranges in {data.periodLabel.toLowerCase()}</p>
          </div>
          <ScoreBarChart buckets={data.scoreBuckets} />
        </div>

        <div className="admin-card flex h-full flex-col p-5">
          <div className="mb-4">
            <h3 className="admin-section-title text-base">Top Hiring Roles</h3>
            <p className="text-xs text-slate-500">Roles with the most interviews</p>
          </div>
          {data.topRoles.length > 0 ? (
            <div className="flex flex-1 flex-col">
              <div className="space-y-3.5">
                {data.topRoles.map((role, i) => {
                  const max = Math.max(1, ...data.topRoles.map((r) => r.count));
                  return (
                    <div key={`${role.role}-${i}`}>
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-semibold text-slate-700 dark:text-slate-200">
                          {i + 1}. {role.role}
                        </span>
                        <span className="shrink-0 text-slate-500">
                          {role.count === 0
                            ? "No interviews yet"
                            : `${role.count} interview${role.count === 1 ? "" : "s"}`}
                          {role.avgScore != null ? ` · ${role.avgScore}% avg score` : ""}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/8">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(role.count > 0 ? 8 : 0, (role.count / max) * 100)}%`,
                            background: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-auto border-t border-slate-100 pt-3 dark:border-white/8">
                <p className="text-[11px] text-slate-500">
                  {data.requirementsCount} saved opening{data.requirementsCount === 1 ? "" : "s"}
                  {data.topRoles.length < 5
                    ? ". More roles appear here as you run interviews."
                    : "."}
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate("requirements")}
                  className="mt-1 text-xs font-semibold text-primary hover:underline"
                >
                  View job openings →
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col justify-between">
              <p className="text-sm text-slate-500">
                No hiring roles yet. Save a job opening and send invites to see roles here.
              </p>
              <button
                type="button"
                onClick={() => onNavigate("requirements")}
                className="mt-4 text-left text-xs font-semibold text-primary hover:underline"
              >
                Create a job opening →
              </button>
            </div>
          )}
        </div>

        <div className="admin-card flex h-full flex-col p-5 md:col-span-2 xl:col-span-1">
          <div className="mb-4">
            <h3 className="admin-section-title text-base">Quick Highlights</h3>
            <p className="text-xs text-slate-500">Simple summary from your pipeline</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => (bestSession ? onOpenSession(bestSession.id) : onNavigate("sessions"))}
              className="dashboard-insight-tile cursor-pointer text-left transition hover:bg-slate-50 dark:hover:bg-white/8"
            >
              <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                <Star className="h-3.5 w-3.5" />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Highest Score</p>
              <p className="mt-1 truncate text-sm font-bold text-[#0f172a] dark:text-white">
                {bestSession?.scorecard?.overallScore != null
                  ? `${bestSession.scorecard.overallScore}%`
                  : "—"}
              </p>
              <p className="truncate text-[10px] text-slate-500">
                {bestSession?.candidateName ?? "No scored interviews"}
              </p>
              <p className="mt-2 text-[10px] font-semibold text-violet-500">Open interview</p>
            </button>
            <button
              type="button"
              onClick={() => (bestSession ? onOpenSession(bestSession.id) : onNavigate("candidates"))}
              className="dashboard-insight-tile cursor-pointer text-left transition hover:bg-slate-50 dark:hover:bg-white/8"
            >
              <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-300">
                <Award className="h-3.5 w-3.5" />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Best Candidate</p>
              <p className="mt-1 truncate text-sm font-bold text-[#0f172a] dark:text-white">
                {bestSession?.candidateName ?? "—"}
              </p>
              <p className="truncate text-[10px] text-slate-500">
                {bestSession?.positionTitle ?? bestSession?.domain ?? "Awaiting data"}
              </p>
              <p className="mt-2 text-[10px] font-semibold text-violet-500">View candidate</p>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("requirements")}
              className="dashboard-insight-tile cursor-pointer text-left transition hover:bg-slate-50 dark:hover:bg-white/8"
            >
              <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-400">
                <Zap className="h-3.5 w-3.5" />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Most Interviewed Role</p>
              <p className="mt-1 truncate text-sm font-bold text-[#0f172a] dark:text-white">
                {mostActiveRole?.role ?? "—"}
              </p>
              <p className="truncate text-[10px] text-slate-500">
                {mostActiveRole ? `${mostActiveRole.count} interviews` : "No roles yet"}
              </p>
              <p className="mt-2 text-[10px] font-semibold text-violet-500">View roles</p>
            </button>
            <button
              type="button"
              onClick={() => onNavigate("overview")}
              className="dashboard-insight-tile cursor-pointer text-left transition hover:bg-slate-50 dark:hover:bg-white/8"
            >
              <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15 text-orange-700 dark:text-orange-400">
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Not Started Yet</p>
              <p className="mt-1 truncate text-sm font-bold text-[#0f172a] dark:text-white">{dropOff}%</p>
              <p className="truncate text-[10px] text-slate-500">
                {periodInvites.pending} candidates have not started yet
              </p>
              <p className="mt-2 text-[10px] font-semibold text-violet-500">View pending</p>
            </button>
          </div>
        </div>
      </section>

      {/* Recent interviews table */}
      <section className="admin-card overflow-hidden p-0">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/8 sm:px-6">
          <div>
            <h3 className="admin-section-title text-base">Recent Interviews</h3>
            <p className="mt-0.5 text-xs text-slate-500">Latest activity across all time</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("sessions")}
            className="flex shrink-0 items-center gap-1 text-xs font-bold text-primary transition hover:text-cyan"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {data.recentSessions.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3 dark:border-white/8 sm:px-6">
              <div className="relative min-w-[12rem] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={sessionSearch}
                  onChange={(event) => setSessionSearch(event.target.value)}
                  placeholder="Search candidate, role, or code"
                  className="border-input bg-background h-8 w-full rounded-md border pr-3 pl-8 text-sm outline-none"
                  aria-label="Search recent interviews"
                />
              </div>
              <AppSelect
                value={sessionStatus}
                onValueChange={setSessionStatus}
                size="sm"
                className="w-[8.75rem]"
                aria-label="Filter by status"
                options={[
                  { value: "ALL", label: "All status" },
                  { value: "READY", label: "Ready" },
                  { value: "LIVE", label: "Live" },
                  { value: "COMPLETED", label: "Completed" },
                ]}
              />
            </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/8">
                  {["Candidate", "Role", "Match", "Session Code", "Time", "Status", ""].map((h) => (
                    <th
                      key={h || "actions"}
                      className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 sm:px-6"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecentSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-500">
                      No interviews match these filters.
                    </td>
                  </tr>
                ) : (
                filteredRecentSessions.map((session) => {
                  const code = formatSessionCode(session);
                  const match = session.scorecard?.overallScore ?? null;
                  return (
                    <tr
                      key={session.id}
                      className="border-b border-slate-50 transition hover:bg-slate-50/80 dark:border-white/5 dark:hover:bg-white/[0.03]"
                    >
                      <td className="px-5 py-3.5 sm:px-6">
                        <button
                          type="button"
                          onClick={() => onOpenSession(session.id)}
                          className="flex items-center gap-3 text-left"
                        >
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white ${AvatarTone(session.candidateName)}`}
                          >
                            {getInitials(session.candidateName)}
                          </span>
                          <span className="truncate text-sm font-semibold text-[#0f172a] dark:text-white">
                            {session.candidateName ?? "Awaiting candidate"}
                          </span>
                        </button>
                      </td>
                      <td className="max-w-[160px] truncate px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300 sm:px-6">
                        {session.positionTitle ?? session.domain}
                      </td>
                      <td className="px-5 py-3.5 sm:px-6">
                        <MatchBar score={match} />
                      </td>
                      <td className="px-5 py-3.5 sm:px-6">
                        <button
                          type="button"
                          onClick={() => void copyCode(session.id, code)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-600 transition hover:bg-slate-200 dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/12"
                          title="Copy session code"
                        >
                          {code}
                          <Copy className="h-3 w-3 opacity-60" />
                          {copiedId === session.id ? (
                            <span className="text-[9px] font-bold text-emerald-400">Copied</span>
                          ) : null}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 sm:px-6">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(session.createdAt)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 sm:px-6">
                        <StatusPill status={session.status} />
                      </td>
                      <td className="px-5 py-3.5 sm:px-6">
                        <button
                          type="button"
                          onClick={() => onOpenSession(session.id)}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                          aria-label="Open session"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
                )}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <div className="rounded-xl px-4 py-10 text-center">
            <p className="text-sm text-slate-500">
              No interviews yet. Go to Invites to create a job opening and invite candidates.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
