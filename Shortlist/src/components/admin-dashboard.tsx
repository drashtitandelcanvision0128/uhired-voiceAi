"use client";

import {
  AlertTriangle,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Mail,
  Minus,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

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
  { key: "7d", label: "Week" },
  { key: "30d", label: "Month" },
  { key: "year", label: "Year" },
];

const CHART_COLORS = ["#3b82f6", "#8b5cf6", "#14b8a6", "#f59e0b", "#ec4899"];

function getInitials(name: string | null) {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value == null) return null;
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-500/15 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400">
        <Minus className="h-3 w-3" /> 0%
      </span>
    );
  }
  const up = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
        up
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
          : "bg-red-500/15 text-red-700 dark:text-red-400"
      }`}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}
      {value}%
    </span>
  );
}

function MiniSparkline({
  points,
  color,
}: {
  points: number[];
  color: string;
}) {
  const w = 72;
  const h = 28;
  const max = Math.max(1, ...points);
  const min = Math.min(0, ...points);
  const range = Math.max(1, max - min);
  const path = points
    .map((v, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible opacity-90">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  sub,
  delta,
  icon: Icon,
  accent,
  spark,
  sparkColor,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  delta?: number | null;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  spark?: number[];
  sparkColor?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`dashboard-kpi-card group flex flex-col gap-2.5 p-4 text-left ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-black tracking-tight text-[#0f172a] dark:text-white">{value}</p>
            {delta != null ? <DeltaBadge value={delta} /> : null}
          </div>
          {sub ? <p className="mt-1 text-[11px] leading-snug text-slate-500">{sub}</p> : null}
        </div>
        {spark && sparkColor ? <MiniSparkline points={spark} color={sparkColor} /> : null}
      </div>
    </Tag>
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
  height = 200,
}: {
  data: Array<{ label: string; created: number; completed: number }>;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 560;
  const pad = { top: 24, right: 14, bottom: 28, left: 34 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const dataMax = Math.max(1, ...data.flatMap((d) => [d.created, d.completed]));
  const maxVal = niceMax(dataMax);
  const mid = Math.round(maxVal / 2);
  const yTicks = [...new Set([0, mid, maxVal])].sort((a, b) => a - b);

  const xPos = (i: number) => pad.left + (i / Math.max(data.length - 1, 1)) * innerW;
  const yPos = (v: number) => {
    const clamped = Math.min(Math.max(v, 0), maxVal);
    return pad.top + innerH - (clamped / maxVal) * innerH;
  };

  const toPath = (key: "created" | "completed") =>
    data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${xPos(i).toFixed(1)} ${yPos(d[key]).toFixed(1)}`)
      .join(" ");

  const createdArea = `${toPath("created")} L ${xPos(data.length - 1).toFixed(1)} ${yPos(0).toFixed(1)} L ${xPos(0).toFixed(1)} ${yPos(0).toFixed(1)} Z`;
  const completedArea = `${toPath("completed")} L ${xPos(data.length - 1).toFixed(1)} ${yPos(0).toFixed(1)} L ${xPos(0).toFixed(1)} ${yPos(0).toFixed(1)} Z`;
  const tip = hover != null ? data[hover] : null;
  const clipId = "session-activity-clip";

  return (
    <div className="relative w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[280px]"
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="areaGradCreated" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="areaGradCompleted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </linearGradient>
          <clipPath id={clipId}>
            <rect x={pad.left} y={pad.top} width={innerW} height={innerH} />
          </clipPath>
        </defs>
        {yTicks.map((tick, tickIndex) => (
          <g key={`ytick-${tickIndex}-${tick}`}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={yPos(tick)}
              y2={yPos(tick)}
              stroke="currentColor"
              className="text-slate-200 dark:text-white/10"
              strokeDasharray="4 4"
            />
            <text
              x={pad.left - 6}
              y={yPos(tick) + 4}
              textAnchor="end"
              className="fill-slate-400 text-[9px]"
            >
              {tick}
            </text>
          </g>
        ))}
        <g clipPath={`url(#${clipId})`}>
          <path d={createdArea} fill="url(#areaGradCreated)" />
          <path d={completedArea} fill="url(#areaGradCompleted)" />
          <path d={toPath("created")} fill="none" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d={toPath("completed")} fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {data.map((d, i) => (
            <g key={`pt-${i}`}>
              <rect
                x={xPos(i) - innerW / data.length / 2}
                y={pad.top}
                width={Math.max(8, innerW / data.length)}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
              {d.created > 0 ? (
                <circle cx={xPos(i)} cy={yPos(d.created)} r={hover === i ? 4.5 : 3} fill="#38bdf8" />
              ) : null}
              {d.completed > 0 ? (
                <circle cx={xPos(i)} cy={yPos(d.completed)} r={hover === i ? 4.5 : 3} fill="#a78bfa" />
              ) : null}
            </g>
          ))}
        </g>
        {data.map((d, i) => (
          <text
            key={`l-${i}`}
            x={xPos(i)}
            y={height - 6}
            textAnchor="middle"
            className="fill-slate-400 text-[8px] font-semibold"
          >
            {data.length > 14 && i % 2 !== 0 ? "" : d.label}
          </text>
        ))}
      </svg>
      {tip && hover != null ? (
        <div
          className="admin-chart-tooltip pointer-events-none absolute z-10 min-w-[140px] -translate-x-1/2"
          style={{
            left: `${(xPos(hover) / width) * 100}%`,
            top: 8,
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{tip.label}</p>
          <p className="mt-1 text-xs font-semibold text-sky-500">New: {tip.created}</p>
          <p className="text-xs font-semibold text-violet-400">Completed: {tip.completed}</p>
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-center gap-5 text-[10px] font-semibold">
        <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-300">
          <span className="h-0.5 w-4 rounded bg-sky-400" /> New Sessions
        </span>
        <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-300">
          <span className="h-0.5 w-4 rounded bg-violet-400" /> Completed
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

function InviteFunnel({
  steps,
}: {
  steps: Array<{ label: string; value: number; color: string }>;
}) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={step.label}>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{step.label}</span>
            <span className="font-bold text-[#0f172a] dark:text-white">{step.value}</span>
          </div>
          <div
            className="relative h-9 overflow-hidden rounded-lg transition-all"
            style={{
              width: `${Math.max(28, (step.value / max) * 100)}%`,
              background: step.color,
              opacity: 0.88 + i * 0.03,
            }}
          >
            <span className="absolute inset-0 flex items-center px-3 text-[10px] font-bold text-white">
              {steps[0].value > 0 ? `${Math.round((step.value / steps[0].value) * 100)}%` : "0%"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function HeroIllustration() {
  return (
    <div className="dashboard-hero-art relative mx-auto hidden h-[180px] w-[220px] shrink-0 lg:block" aria-hidden>
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-400/20 via-violet-500/25 to-fuchsia-500/15 blur-2xl" />
      <div className="absolute left-6 top-4 h-24 w-36 rotate-[-8deg] rounded-2xl border border-white/20 bg-white/10 p-3 shadow-2xl backdrop-blur-md">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-7 w-7 rounded-full bg-gradient-to-br from-sky-400 to-violet-500" />
          <div className="space-y-1">
            <div className="h-1.5 w-14 rounded bg-white/50" />
            <div className="h-1 w-10 rounded bg-white/30" />
          </div>
        </div>
        <div className="h-1.5 w-full rounded bg-emerald-400/70" />
        <div className="mt-2 h-1.5 w-3/4 rounded bg-white/25" />
      </div>
      <div className="absolute bottom-2 right-2 h-28 w-40 rotate-[6deg] rounded-2xl border border-white/25 bg-white/12 p-3 shadow-2xl backdrop-blur-md">
        <div className="mb-3 flex h-14 items-end gap-1.5">
          {[18, 28, 20, 36, 24, 40].map((h, i) => (
            <span
              key={i}
              className="w-3 rounded-t bg-gradient-to-t from-violet-500 to-cyan-300"
              style={{ height: `${h}px` }}
            />
          ))}
        </div>
        <div className="h-1.5 w-full rounded bg-white/35" />
        <div className="mt-1.5 h-1.5 w-2/3 rounded bg-white/20" />
      </div>
      <div className="absolute right-8 top-10 flex h-10 w-10 items-center justify-center rounded-xl border border-white/30 bg-violet-500/40 shadow-lg backdrop-blur-sm">
        <Sparkles className="h-5 w-5 text-white" />
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
  loading,
  period,
  onPeriodChange,
  onNavigate,
  onOpenSession,
  formatSessionCode,
  formatRelativeTime,
}: AdminDashboardProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sparkFromTrend = useMemo(() => {
    if (!data?.sessionsTrend?.length) return [2, 4, 3, 6, 5, 8, 7];
    return data.sessionsTrend.slice(-8).map((d) => d.created + d.completed);
  }, [data?.sessionsTrend]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="admin-hero relative h-44 overflow-hidden rounded-2xl p-5 text-white">
          <p className="text-sm text-blue-100/80">Loading analytics…</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="admin-card h-28 animate-pulse bg-slate-50 dark:bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  const { statusCounts, periodCounts, invites, periodInvites, comparisons } = data;

  const statusSegments = [
    { label: "Completed", value: statusCounts.completed, color: "#2dd4bf" },
    { label: "Ready", value: statusCounts.ready, color: "#a78bfa" },
    { label: "Live", value: statusCounts.live, color: "#38bdf8" },
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

  const heroMetrics = [
    {
      label: "New Sessions",
      value: periodCounts.total,
      color: "#38bdf8",
    },
    {
      label: "Completed",
      value: periodCounts.completed,
      color: "#a78bfa",
    },
    {
      label: "New Candidates",
      value: data.newCandidatesInPeriod,
      color: "#34d399",
    },
    {
      label: "Active Roles",
      value: data.requirementsCount,
      color: "#fbbf24",
    },
  ];

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
    <div className="space-y-5 pb-4">
      {/* Hero */}
      <section className="admin-hero relative overflow-visible rounded-2xl p-5 text-white md:p-6">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute inset-x-0 bottom-0 h-24 opacity-40">
            <svg viewBox="0 0 800 80" className="h-full w-full" preserveAspectRatio="none">
              <path
                d="M0 60 Q100 20 200 45 T400 35 T600 50 T800 25 V80 H0 Z"
                fill="url(#heroWave)"
                opacity="0.5"
              />
              <defs>
                <linearGradient id="heroWave" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
                  <stop offset="50%" stopColor="#818cf8" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#c084fc" stopOpacity="0.35" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3">
              <p className="text-sm font-medium text-white/75">
                {timeGreeting()}, {companyName}!
              </p>
              <h2 className="font-display mt-1 text-2xl font-extrabold tracking-tight md:text-[1.85rem]">
                Let&apos;s build the future team.
              </h2>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {heroMetrics.map((m) => (
                <div
                  key={m.label}
                  className="rounded-xl border border-white/15 bg-white/8 px-3 py-2.5 backdrop-blur-sm"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/65">{m.label}</p>
                  <div className="mt-1 flex items-end justify-between gap-2">
                    <p className="text-xl font-black tabular-nums">{m.value}</p>
                    <MiniSparkline points={sparkFromTrend} color={m.color} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <HeroIllustration />
        </div>
      </section>

      {/* KPI strip */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          label="Sessions"
          value={periodCounts.total}
          delta={comparisons.sessionsCreated.deltaPct}
          sub={`${statusCounts.total} all-time · ${periodCounts.open} open`}
          icon={Video}
          accent="bg-sky-500/15 text-sky-700 ring-1 ring-sky-500/25 dark:text-sky-400"
          spark={sparkFromTrend}
          sparkColor="#38bdf8"
          onClick={() => onNavigate("sessions")}
        />
        <KpiCard
          label="Candidates"
          value={data.candidatesCount}
          sub={`+${data.newCandidatesInPeriod} new`}
          icon={Users}
          accent="bg-violet-500/15 text-violet-700 ring-1 ring-violet-500/25 dark:text-violet-300"
          spark={sparkFromTrend.map((n) => Math.max(0, n - 1))}
          sparkColor="#a78bfa"
          onClick={() => onNavigate("candidates")}
        />
        <KpiCard
          label="Avg Match Score"
          value={data.averageScore != null ? `${data.averageScore}%` : "—"}
          delta={comparisons.averageScore.deltaPct}
          sub={data.prevAverageScore != null ? `Prev: ${data.prevAverageScore}%` : "No scores yet"}
          icon={Target}
          accent="bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-400"
          spark={sparkFromTrend.map((n) => n + 2)}
          sparkColor="#34d399"
        />
        <KpiCard
          label="Completion Rate"
          value={`${data.completionRate}%`}
          sub={`${periodCounts.completed} of ${periodCounts.total} finished`}
          icon={CheckCircle2}
          accent="bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/25 dark:text-amber-400"
          spark={sparkFromTrend.map((n, i) => (i % 2 ? n + 1 : n))}
          sparkColor="#fbbf24"
        />
        <KpiCard
          label="Requirements"
          value={data.requirementsCount}
          sub="Active role configs"
          icon={FileText}
          accent="bg-blue-500/15 text-blue-700 ring-1 ring-blue-500/25 dark:text-blue-400"
          spark={sparkFromTrend}
          sparkColor="#60a5fa"
          onClick={() => onNavigate("requirements")}
        />
        <KpiCard
          label="Pending Invites"
          value={invites.pending}
          sub={`${invites.sent} sent · ${invites.used} used`}
          icon={Mail}
          accent="bg-orange-500/15 text-orange-700 ring-1 ring-orange-500/25 dark:text-orange-400"
          spark={sparkFromTrend.map((n) => Math.max(1, 10 - n))}
          sparkColor="#fb923c"
          onClick={() => onNavigate("overview")}
        />
      </section>

      {/* Charts row */}
      <section className="grid gap-4 xl:grid-cols-12">
        <div className="admin-card p-5 xl:col-span-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="admin-section-title text-base">Session Activity</h3>
              <p className="text-xs text-slate-500">
                {data.periodLabel} — {trendTotalCreated} created, {trendTotalCompleted} completed
              </p>
            </div>
            <div className="dashboard-chart-period" role="group" aria-label="Chart period">
              {CHART_PERIOD_TABS.map((tab) => {
                const active =
                  period === tab.key || (tab.key === "30d" && period === "month");
                return (
                  <button
                    key={tab.key}
                    type="button"
                    className={`dashboard-chart-period-btn ${active ? "is-active" : ""}`}
                    aria-pressed={active}
                    onClick={() => onPeriodChange(tab.key)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
          {data.sessionsTrend.some((d) => d.created > 0 || d.completed > 0) ? (
            <AreaLineChart data={data.sessionsTrend} />
          ) : (
            <div className="flex h-36 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500 dark:bg-white/5">
              No session activity in this period yet.
            </div>
          )}
        </div>

        <div className="admin-card min-w-0 overflow-hidden p-5 xl:col-span-3">
          <div className="mb-4 flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="admin-section-title text-base">Status Breakdown</h3>
              <p className="truncate text-xs text-slate-500">{data.periodLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("sessions")}
              className="shrink-0 text-xs font-bold text-violet-400 hover:underline"
            >
              View all →
            </button>
          </div>
          {statusSegments.length > 0 ? (
            <DonutChart
              segments={statusSegments}
              centerValue={statusCounts.total}
              centerLabel="TOTAL"
              size={132}
            />
          ) : (
            <p className="text-sm text-slate-500">No sessions yet.</p>
          )}
        </div>

        <div className="admin-card p-5 xl:col-span-4">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h3 className="admin-section-title text-base">Conversion Funnel</h3>
              <p className="text-xs text-slate-500">{periodInvites.conversionRate}% conversion</p>
            </div>
            <DeltaBadge value={comparisons.invitesSent.deltaPct} />
          </div>
          <InviteFunnel
            steps={[
              { label: "Invites Created", value: periodInvites.total, color: "#7c3aed" },
              { label: "Emails Sent", value: periodInvites.sent, color: "#3b82f6" },
              { label: "Codes Used", value: periodInvites.used, color: "#14b8a6" },
              { label: "Awaiting Use", value: periodInvites.pending, color: "#f59e0b" },
            ]}
          />
        </div>
      </section>

      {/* Insights row */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="admin-card flex h-full flex-col p-5">
          <div className="mb-4">
            <h3 className="admin-section-title text-base">Match Scores</h3>
            <p className="text-xs text-slate-500">Distribution in {data.periodLabel.toLowerCase()}</p>
          </div>
          <ScoreBarChart buckets={data.scoreBuckets} />
        </div>

        <div className="admin-card flex h-full flex-col p-5">
          <div className="mb-4">
            <h3 className="admin-section-title text-base">Top Roles</h3>
            <p className="text-xs text-slate-500">By session volume</p>
          </div>
          {data.topRoles.length > 0 ? (
            <div className="space-y-3.5">
              {data.topRoles.map((role, i) => {
                const max = Math.max(1, ...data.topRoles.map((r) => r.count));
                return (
                  <div key={role.role}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-semibold text-slate-700 dark:text-slate-200">
                        {i + 1}. {role.role}
                      </span>
                      <span className="shrink-0 text-slate-500">
                        {role.count} · {role.avgScore != null ? `${role.avgScore}% avg` : "no scores"}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/8">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(role.count / max) * 100}%`,
                          background: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No role data in this period.</p>
          )}
        </div>

        <div className="admin-card flex h-full flex-col p-5 md:col-span-2 xl:col-span-1">
          <div className="mb-4">
            <h3 className="admin-section-title text-base">AI Insights</h3>
            <p className="text-xs text-slate-500">Highlights from your pipeline</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="dashboard-insight-tile">
              <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                <Star className="h-3.5 w-3.5" />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Best Match</p>
              <p className="mt-1 truncate text-sm font-bold text-[#0f172a] dark:text-white">
                {bestSession?.scorecard?.overallScore != null
                  ? `${bestSession.scorecard.overallScore}%`
                  : "—"}
              </p>
              <p className="truncate text-[10px] text-slate-500">
                {bestSession?.candidateName ?? "No scored sessions"}
              </p>
            </div>
            <div className="dashboard-insight-tile">
              <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-300">
                <Award className="h-3.5 w-3.5" />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Top Performer</p>
              <p className="mt-1 truncate text-sm font-bold text-[#0f172a] dark:text-white">
                {bestSession?.candidateName ?? "—"}
              </p>
              <p className="truncate text-[10px] text-slate-500">
                {bestSession?.positionTitle ?? bestSession?.domain ?? "Awaiting data"}
              </p>
            </div>
            <div className="dashboard-insight-tile">
              <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-400">
                <Zap className="h-3.5 w-3.5" />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Most Active Role</p>
              <p className="mt-1 truncate text-sm font-bold text-[#0f172a] dark:text-white">
                {mostActiveRole?.role ?? "—"}
              </p>
              <p className="truncate text-[10px] text-slate-500">
                {mostActiveRole ? `${mostActiveRole.count} sessions` : "No roles yet"}
              </p>
            </div>
            <div className="dashboard-insight-tile">
              <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15 text-orange-700 dark:text-orange-400">
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Drop-off Alert</p>
              <p className="mt-1 truncate text-sm font-bold text-[#0f172a] dark:text-white">{dropOff}%</p>
              <p className="truncate text-[10px] text-slate-500">
                {periodInvites.pending} invites awaiting use
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent sessions table */}
      <section className="admin-card overflow-hidden p-0">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/8 sm:px-6">
          <div>
            <h3 className="admin-section-title text-base">Recent Sessions</h3>
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
                {data.recentSessions.map((session) => {
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
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl px-4 py-10 text-center">
            <p className="text-sm text-slate-500">
              No sessions yet. Go to Overview to set up requirements and invite candidates.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
