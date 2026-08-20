"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CreditCard,
  Database,
  Mail,
  RefreshCw,
  Search,
  Server,
  Settings,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { MasterShell } from "@/components/master-shell";
import {
  MASTER_PAGE_SIZE_OPTIONS,
  MasterPageSize,
  MasterPagination,
  paginateItems,
} from "@/components/master-pagination";
import {
  MasterAlert,
  masterBtnGhost,
  masterBtnPrimary,
  masterInputClass,
  masterTableHeadClass,
} from "@/components/master-ui";

type SettingStatus = "configured" | "missing" | "optional" | "warning";

type SettingItem = {
  id: string;
  label: string;
  description: string;
  status: SettingStatus;
  value: string;
  envKey?: string;
};

type SettingGroup = {
  id: string;
  title: string;
  description: string;
  items: SettingItem[];
};

type SettingsResponse = {
  summary: {
    configuredCount: number;
    missingCount: number;
    warningCount: number;
    optionalCount: number;
    totalChecks: number;
    healthPct: number;
    environment: string;
    appUrl: string;
  };
  groups: SettingGroup[];
  notes: string[];
};

const GROUP_ICONS: Record<string, typeof Settings> = {
  platform: Server,
  auth: Shield,
  ai: Sparkles,
  payments: CreditCard,
  email: Mail,
  storage: Cloud,
};

const STATUS_META: Record<SettingStatus, { label: string; className: string }> = {
  configured: {
    label: "Ready",
    className: "bg-success/12 text-success ring-1 ring-success/25",
  },
  missing: {
    label: "Missing",
    className: "bg-destructive/12 text-destructive ring-1 ring-destructive/25",
  },
  warning: {
    label: "Check",
    className: "bg-warning/12 text-warning ring-1 ring-warning/25",
  },
  optional: {
    label: "Optional",
    className: "bg-muted text-muted-foreground ring-1 ring-border",
  },
};

const GROUP_ACCENTS: Record<string, string> = {
  platform: "bg-primary/12 text-primary",
  auth: "bg-violet/12 text-violet",
  ai: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  payments: "bg-success/12 text-success",
  email: "bg-cyan/12 text-cyan",
  storage: "bg-primary/12 text-primary",
};

export default function MasterSystemSettingsPage() {
  const router = useRouter();
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [statusInput, setStatusInput] = useState<"ALL" | SettingStatus>("ALL");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedStatus, setAppliedStatus] = useState<"ALL" | SettingStatus>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<MasterPageSize>(MASTER_PAGE_SIZE_OPTIONS[0]);

  const hasActiveFilters = appliedSearch !== "" || appliedStatus !== "ALL";

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/master/system-settings");
      const payload = (await res.json()) as SettingsResponse & { error?: string };
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok) {
        setError(payload.error ?? "Could not load settings.");
        return;
      }
      setData(payload);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  function applyFilters() {
    setAppliedSearch(searchInput.trim());
    setAppliedStatus(statusInput);
    setPage(1);
  }

  function clearFilters() {
    setSearchInput("");
    setStatusInput("ALL");
    setAppliedSearch("");
    setAppliedStatus("ALL");
    setPage(1);
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      applyFilters();
    }
  }

  const flatItems = useMemo(() => {
    return (data?.groups ?? []).flatMap((group) =>
      group.items.map((item) => ({
        ...item,
        groupTitle: group.title,
        groupId: group.id,
      })),
    );
  }, [data?.groups]);

  const filteredItems = useMemo(() => {
    const query = appliedSearch.toLowerCase();
    return flatItems.filter((item) => {
      const matchesSearch =
        !query ||
        item.label.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.value.toLowerCase().includes(query) ||
        item.groupTitle.toLowerCase().includes(query) ||
        item.envKey?.toLowerCase().includes(query);
      const matchesStatus = appliedStatus === "ALL" || item.status === appliedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [flatItems, appliedSearch, appliedStatus]);

  const paginatedItems = useMemo(
    () => paginateItems(filteredItems, page, pageSize),
    [filteredItems, page, pageSize],
  );

  const healthOk = (data?.summary.healthPct ?? 0) >= 80;

  return (
    <MasterShell title="Settings" subtitle="Which services are connected.">
      <div className="space-y-3">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

        {data?.summary.appUrl ? (
          <p className="text-sm text-muted-foreground">
            App URL <span className="font-medium text-foreground">{data.summary.appUrl}</span>
          </p>
        ) : null}

        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <article className="admin-card flex items-center gap-3 p-3">
            <div className={`flex size-9 items-center justify-center rounded-lg ${healthOk ? "bg-success/12 text-success" : "bg-warning/12 text-warning"}`}>
              {healthOk ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Health</p>
              <p className="text-lg font-semibold text-foreground">{data?.summary.healthPct ?? 0}%</p>
            </div>
          </article>
          <article className="admin-card p-3">
            <p className="text-xs text-muted-foreground">Ready</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{data?.summary.configuredCount ?? 0}</p>
          </article>
          <article className="admin-card p-3">
            <p className="text-xs text-muted-foreground">Missing</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{data?.summary.missingCount ?? 0}</p>
          </article>
          <article className="admin-card p-3">
            <p className="text-xs text-muted-foreground">Check</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{data?.summary.warningCount ?? 0}</p>
          </article>
          <article className="admin-card p-3">
            <p className="text-xs text-muted-foreground">Environment</p>
            <p className="mt-1 text-lg font-semibold capitalize text-foreground">{data?.summary.environment ?? "—"}</p>
          </article>
        </section>

        {(data?.notes ?? []).length ? (
          <div className="space-y-1.5">
            {data?.notes.map((note) => (
              <p key={note} className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-foreground ring-1 ring-warning/25">
                {note}
              </p>
            ))}
          </div>
        ) : null}

        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {(data?.groups ?? []).map((group) => {
            const Icon = GROUP_ICONS[group.id] ?? Database;
            const ready = group.items.filter((item) => item.status === "configured").length;
            return (
              <article key={group.id} className="admin-card flex items-center gap-3 p-3">
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${GROUP_ACCENTS[group.id] ?? "bg-primary/12 text-primary"}`}>
                  <Icon className="size-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{group.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {ready}/{group.items.length} ready
                  </p>
                </div>
              </article>
            );
          })}
        </section>

        <section className="admin-card overflow-hidden">
          <div className="space-y-3 border-b border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[12rem] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Name or env key"
                  className={`${masterInputClass} w-full pl-10`}
                  aria-label="Search settings"
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
              {(["ALL", "configured", "missing", "warning", "optional"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    setStatusInput(status);
                    setAppliedStatus(status);
                    setPage(1);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    appliedStatus === status
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {status === "ALL" ? "All" : STATUS_META[status].label}
                </button>
              ))}
            </div>
          </div>

          {loading && !flatItems.length ? (
            <div className="space-y-2 p-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : !filteredItems.length ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-semibold text-foreground">No matching settings</p>
              {hasActiveFilters ? (
                <button type="button" onClick={clearFilters} className={`${masterBtnGhost} mt-3 inline-flex items-center gap-1.5`}>
                  <X className="h-4 w-4" />
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr className={masterTableHeadClass}>
                    <th className="px-3 py-2">Setting</th>
                    <th className="pr-4">Group</th>
                    <th className="pr-4">Status</th>
                    <th className="pr-4">Value</th>
                    <th className="pr-3">Env</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.items.map((item) => {
                    const statusMeta = STATUS_META[item.status];
                    return (
                      <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-foreground">{item.label}</p>
                          <p className="mt-0.5 max-w-md truncate text-xs text-muted-foreground" title={item.description}>
                            {item.description}
                          </p>
                        </td>
                        <td className="pr-4 text-muted-foreground">{item.groupTitle}</td>
                        <td className="pr-4">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="pr-4 font-medium text-foreground">{item.value}</td>
                        <td className="pr-3">
                          {item.envKey ? (
                            <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground">{item.envKey}</code>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <MasterPagination
            page={page}
            pageSize={pageSize}
            totalItems={filteredItems.length}
            itemLabel="settings"
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
