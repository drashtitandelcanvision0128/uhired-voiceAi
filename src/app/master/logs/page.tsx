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
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function shortMeta(value: string) {
  if (value.includes("@") && value.length > 32) {
    const [local, domain] = value.split("@");
    return `${local.slice(0, 10)}…@${domain}`;
  }
  if (value.length > 24) return `${value.slice(0, 10)}…${value.slice(-4)}`;
  return value;
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
        setError(payload.error ?? "Could not load logs.");
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
    <MasterShell title="Logs" subtitle="What happened on the platform.">
      <div className="space-y-4">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Events", value: data?.summary.totalLogs ?? 0, icon: ScrollText, accent: "bg-primary/12 text-primary" },
            { label: "Last 24h", value: data?.summary.last24Hours ?? 0, icon: Clock, accent: "bg-violet/12 text-violet" },
            { label: "Warnings", value: data?.summary.warnings ?? 0, icon: AlertTriangle, accent: "bg-warning/12 text-warning" },
            { label: "Errors", value: data?.summary.errors ?? 0, icon: XCircle, accent: "bg-destructive/12 text-destructive" },
            { label: "Live", value: data?.summary.liveSessions ?? 0, icon: Activity, accent: "bg-success/12 text-success" },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.label} className="admin-card flex items-center gap-3 p-3.5">
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${card.accent}`}>
                  <Icon className="size-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className="text-lg font-semibold tracking-tight text-foreground">{card.value}</p>
                </div>
              </article>
            );
          })}
        </section>

        <section className="admin-card overflow-hidden">
          <div className="space-y-3 border-b border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[14rem] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search activity"
                  className={`${masterInputClass} w-full pl-10`}
                  aria-label="Search logs"
                />
              </div>
              <button type="button" onClick={applyFilters} className={`${masterBtnPrimary} !px-4`}>
                Search
              </button>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className={`${masterBtnGhost} inline-flex h-10 items-center justify-center !px-3 disabled:opacity-60`}
                aria-label="Refresh"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className={`${masterBtnGhost} inline-flex h-10 items-center justify-center !px-3`}
                  aria-label="Clear filters"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(["", "INFO", "SUCCESS", "WARNING", "ERROR"] as const).map((level) => (
                <button
                  key={level || "all-levels"}
                  type="button"
                  onClick={() => {
                    setLevelInput(level);
                    setAppliedLevel(level);
                    setPage(1);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    appliedLevel === level
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {level === "" ? "All" : level === "INFO" ? "Info" : level === "SUCCESS" ? "Success" : level === "WARNING" ? "Warning" : "Error"}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setCategoryInput("");
                  setAppliedCategory("");
                  setPage(1);
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  appliedCategory === ""
                    ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
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
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    appliedCategory === option.value
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {loading && !(data?.logs.length ?? 0) ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-14 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : !(data?.logs.length ?? 0) ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-semibold text-foreground">No matching events</p>
              {hasActiveFilters ? (
                <button type="button" onClick={clearFilters} className={`${masterBtnGhost} mt-3 inline-flex items-center gap-1.5`}>
                  <X className="h-4 w-4" />
                  Clear filters
                </button>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Activity will show up here.</p>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(data?.logs ?? []).map((log) => {
                const levelMeta = LEVEL_STYLES[log.level];
                const CategoryIcon = CATEGORY_ICONS[log.category] ?? ScrollText;
                const metaEntries = Object.entries(log.metadata);
                return (
                  <li key={log.id} className="px-4 py-3 hover:bg-muted/40">
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ${levelMeta.accent}`}
                      >
                        <CategoryIcon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="font-semibold text-foreground">{log.title}</p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${levelMeta.className}`}
                          >
                            {log.level === "INFO" ? "Info" : log.level === "SUCCESS" ? "Success" : log.level === "WARNING" ? "Warning" : "Error"}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${
                              CATEGORY_STYLES[log.category] ?? "bg-muted text-muted-foreground ring-border"
                            }`}
                          >
                            {log.category}
                          </span>
                          <time className="ml-auto text-xs text-muted-foreground">{formatTimestamp(log.timestamp)}</time>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{log.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{log.actor}</p>
                        {metaEntries.length ? (
                          <details className="mt-1.5">
                            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                              Details
                            </summary>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {metaEntries.map(([key, value]) => (
                                <span
                                  key={key}
                                  title={`${key}: ${value}`}
                                  className="rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] text-foreground"
                                >
                                  {key}: {shortMeta(value)}
                                </span>
                              ))}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <MasterPagination
            page={page}
            pageSize={pageSize}
            totalItems={data?.pagination.total ?? 0}
            itemLabel="events"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </section>
      </div>
    </MasterShell>
  );
}
