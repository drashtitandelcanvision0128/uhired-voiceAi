"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Activity,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Info,
  Mail,
  RefreshCw,
  ScrollText,
  Search,
  Shield,
  TicketPercent,
  X,
  XCircle,
  EyeOff,
} from "lucide-react";
import { MasterShell } from "@/components/master-shell";
import {
  MASTER_PAGE_SIZE_OPTIONS,
  MasterPageSize,
  MasterPagination,
} from "@/components/master-pagination";
import {
  MasterAlert,
  MasterCard,
  MasterHero,
  MasterKpiCard,
  masterBtnGhost,
  masterBtnPrimary,
  masterInputClass,
} from "@/components/master-ui";
import { LOG_CATEGORY_OPTIONS, type LogCategory } from "@/lib/platform-audit-log";

type LogLevel = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

type LogEntry = {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  title: string;
  message: string;
  actor: string;
  metadata: Record<string, string>;
};

type LogsResponse = {
  summary: {
    totalLogs: number;
    last24Hours: number;
    errors: number;
    warnings: number;
    liveSessions: number;
  };
  categoryCounts: Partial<Record<LogCategory, number>>;
  levelCounts: Partial<Record<LogLevel, number>>;
  logs: LogEntry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

const LEVEL_STYLES: Record<LogLevel, { className: string; icon: typeof Info; accent: string }> = {
  INFO: {
    className: "bg-primary/12 text-primary ring-primary/25",
    icon: Info,
    accent: "bg-primary/12 text-primary ring-primary/25",
  },
  SUCCESS: {
    className: "bg-success/12 text-success ring-success/25",
    icon: CheckCircle2,
    accent: "bg-success/12 text-success ring-success/25",
  },
  WARNING: {
    className: "bg-warning/12 text-warning ring-warning/25",
    icon: AlertTriangle,
    accent: "bg-warning/12 text-warning ring-warning/25",
  },
  ERROR: {
    className: "bg-destructive/12 text-destructive ring-destructive/25",
    icon: XCircle,
    accent: "bg-destructive/12 text-destructive ring-destructive/25",
  },
};

const CATEGORY_STYLES: Record<LogCategory, string> = {
  SESSION: "bg-violet/12 text-violet ring-violet/25",
  COMPANY: "bg-primary/12 text-primary ring-primary/25",
  PAYMENT: "bg-success/12 text-success ring-success/25",
  INVITE: "bg-cyan/12 text-cyan ring-cyan/25",
  PROMO: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/25 dark:text-indigo-300",
  SYSTEM: "bg-surface/80 text-muted-foreground ring-border",
  PRIVACY: "bg-violet/12 text-violet ring-violet/25",
  SECURITY: "bg-destructive/12 text-destructive ring-destructive/25",
};

const CATEGORY_ICONS: Record<LogCategory, typeof ScrollText> = {
  SESSION: ScrollText,
  COMPANY: Building2,
  PAYMENT: CreditCard,
  INVITE: Mail,
  PROMO: TicketPercent,
  SYSTEM: FileText,
  PRIVACY: EyeOff,
  SECURITY: Shield,
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export default function MasterLogsPage() {
  const router = useRouter();
  const [data, setData] = useState<LogsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [categoryInput, setCategoryInput] = useState<"" | LogCategory>("");
  const [levelInput, setLevelInput] = useState<"" | LogLevel>("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedCategory, setAppliedCategory] = useState<"" | LogCategory>("");
  const [appliedLevel, setAppliedLevel] = useState<"" | LogLevel>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<MasterPageSize>(MASTER_PAGE_SIZE_OPTIONS[0]);

  const hasActiveFilters = Boolean(appliedSearch || appliedCategory || appliedLevel);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (appliedSearch) params.set("search", appliedSearch);
      if (appliedCategory) params.set("category", appliedCategory);
      if (appliedLevel) params.set("level", appliedLevel);

      const res = await fetch(`/api/master/logs?${params.toString()}`);
      const payload = (await res.json()) as LogsResponse & { error?: string };
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok) {
        setError(payload.error ?? "Unable to load logs.");
        return;
      }
      setData(payload);
    } finally {
      setLoading(false);
    }
  }, [router, page, pageSize, appliedSearch, appliedCategory, appliedLevel]);

  function applyFilters() {
    setAppliedSearch(searchInput.trim());
    setAppliedCategory(categoryInput);
    setAppliedLevel(levelInput);
    setPage(1);
  }

  function clearFilters() {
    setSearchInput("");
    setCategoryInput("");
    setLevelInput("");
    setAppliedSearch("");
    setAppliedCategory("");
    setAppliedLevel("");
    setPage(1);
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      applyFilters();
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  return (
    <MasterShell
      title="Platform Logs"
      subtitle="Real-time activity feed — sessions, companies, payments, invites, and promo events."
      topActions={
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={`${masterBtnGhost} inline-flex items-center gap-2 !px-4 !py-2.5 disabled:opacity-60`}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh logs
        </button>
      }
    >
      <div className="space-y-5">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

        <MasterHero
          badge="Activity feed"
          title="Platform logs"
          subtitle="Important activities across the platform — practice sessions, company onboarding, payment verification, invites, and promo usage. Useful for debugging, monitoring, and audits."
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MasterKpiCard
            label="Total events"
            value={data?.summary.totalLogs ?? 0}
            icon={ScrollText}
            accent="bg-primary/12 text-primary ring-primary/25"
          />
          <MasterKpiCard
            label="Last 24 hours"
            value={data?.summary.last24Hours ?? 0}
            icon={Clock}
            accent="bg-violet/12 text-violet ring-violet/25"
          />
          <MasterKpiCard
            label="Warnings"
            value={data?.summary.warnings ?? 0}
            icon={AlertTriangle}
            accent="bg-warning/12 text-warning ring-warning/25"
          />
          <MasterKpiCard
            label="Errors"
            value={data?.summary.errors ?? 0}
            icon={XCircle}
            accent="bg-destructive/12 text-destructive ring-destructive/25"
          />
          <MasterKpiCard
            label="Live now"
            value={data?.summary.liveSessions ?? 0}
            icon={Activity}
            accent="bg-success/12 text-success ring-success/25"
          />
        </section>

        <MasterCard
          elevated
          title="Activity log"
          subtitle="Search and filter events across the platform."
        >
          <div className="mb-6 rounded-xl border border-border bg-surface/40 p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
              <label className="block space-y-1.5">
                <span className="admin-label">Search logs</span>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Title, message, actor, metadata..."
                    className={`${masterInputClass} w-full pl-10`}
                  />
                </div>
              </label>

              <label className="block space-y-1.5">
                <span className="admin-label">Category</span>
                <select
                  value={categoryInput}
                  onChange={(event) => setCategoryInput(event.target.value as "" | LogCategory)}
                  className={`${masterInputClass} w-full`}
                >
                  <option value="">All categories</option>
                  {LOG_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="admin-label">Level</span>
                <select
                  value={levelInput}
                  onChange={(event) => setLevelInput(event.target.value as "" | LogLevel)}
                  className={`${masterInputClass} w-full`}
                >
                  <option value="">All levels</option>
                  <option value="INFO">Info</option>
                  <option value="SUCCESS">Success</option>
                  <option value="WARNING">Warning</option>
                  <option value="ERROR">Error</option>
                </select>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyFilters}
                  className={`${masterBtnPrimary} inline-flex items-center gap-2 !px-5`}
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Search
                </button>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className={`${masterBtnGhost} inline-flex items-center gap-2 !px-4`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Clear
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(["", "INFO", "SUCCESS", "WARNING", "ERROR"] as const).map((level) => (
                <button
                  key={level || "all-levels"}
                  type="button"
                  onClick={() => {
                    setLevelInput(level);
                    setAppliedLevel(level);
                    setPage(1);
                  }}
                  className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                    appliedLevel === level
                      ? "text-primary-foreground shadow-[var(--shadow-glow)]"
                      : "bg-surface/60 text-muted-foreground ring-1 ring-border hover:text-foreground"
                  }`}
                  style={
                    appliedLevel === level ? { background: "var(--gradient-brand)" } : undefined
                  }
                >
                  {level === "" ? "All levels" : level}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setCategoryInput("");
                  setAppliedCategory("");
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  appliedCategory === ""
                    ? "text-primary-foreground shadow-[var(--shadow-glow)]"
                    : "bg-surface/60 text-muted-foreground ring-1 ring-border hover:text-foreground"
                }`}
                style={
                  appliedCategory === "" ? { background: "var(--gradient-brand)" } : undefined
                }
              >
                All categories
              </button>
              {LOG_CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setCategoryInput(option.value);
                    setAppliedCategory(option.value);
                    setPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    appliedCategory === option.value
                      ? "text-primary-foreground shadow-[var(--shadow-glow)]"
                      : "bg-surface/60 text-muted-foreground ring-1 ring-border hover:text-foreground"
                  }`}
                  style={
                    appliedCategory === option.value
                      ? { background: "var(--gradient-brand)" }
                      : undefined
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>

            {hasActiveFilters ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Active filters
                </span>
                {appliedSearch ? (
                  <span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
                    Search: {appliedSearch}
                  </span>
                ) : null}
                {appliedCategory ? (
                  <span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
                    Category: {appliedCategory}
                  </span>
                ) : null}
                {appliedLevel ? (
                  <span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
                    Level: {appliedLevel}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {loading && !(data?.logs.length ?? 0) ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-28 animate-pulse rounded-2xl bg-surface/60" />
              ))}
            </div>
          ) : (
          <div className="space-y-3">
            {(data?.logs ?? []).map((log) => {
              const levelMeta = LEVEL_STYLES[log.level];
              const LevelIcon = levelMeta.icon;
              const CategoryIcon = CATEGORY_ICONS[log.category] ?? ScrollText;
              return (
                <article
                  key={log.id}
                  className="glow-card rounded-2xl border border-border bg-surface/30 p-4 transition hover:border-primary/20 hover:bg-surface/50 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${levelMeta.accent}`}
                      >
                        <CategoryIcon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground">{log.title}</p>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ring-1 ${levelMeta.className}`}
                          >
                            <LevelIcon className="h-3 w-3" aria-hidden="true" />
                            {log.level}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ring-1 ${
                              CATEGORY_STYLES[log.category] ?? "bg-surface/80 text-muted-foreground ring-border"
                            }`}
                          >
                            {log.category}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{log.message}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Actor: <span className="font-medium text-foreground">{log.actor}</span>
                        </p>
                        {Object.keys(log.metadata).length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {Object.entries(log.metadata).map(([key, value]) => (
                              <span
                                key={key}
                                className="rounded-lg bg-surface/60 px-2.5 py-1 text-[10px] font-semibold text-foreground ring-1 ring-border"
                              >
                                {key}: {value}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <time className="shrink-0 text-xs font-medium text-muted-foreground">
                      {formatTimestamp(log.timestamp)}
                    </time>
                  </div>
                </article>
              );
            })}
          </div>
          )}

          <MasterPagination
            page={page}
            pageSize={pageSize}
            totalItems={data?.pagination.total ?? 0}
            itemLabel="log entries"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />

          {loading && (data?.logs.length ?? 0) > 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Refreshing logs…</p>
          ) : null}
          {!loading && !(data?.logs.length ?? 0) ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface/30 px-4 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/25">
                <ScrollText className="h-6 w-6" aria-hidden />
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">No log entries match your filters</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Events appear here when sessions, companies, payments, or invites are created on the platform.
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className={`${masterBtnGhost} mt-4 inline-flex items-center gap-2`}
                >
                  <X className="h-4 w-4" aria-hidden />
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : null}
        </MasterCard>
      </div>
    </MasterShell>
  );
}
