"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
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
  MasterCard,
  MasterHero,
  MasterInfoCard,
  MasterKpiCard,
  MasterSelect,
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

const STATUS_META: Record<
  SettingStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  configured: {
    label: "Configured",
    className: "bg-success/12 text-success ring-1 ring-success/25",
    icon: CheckCircle2,
  },
  missing: {
    label: "Missing",
    className: "bg-destructive/12 text-destructive ring-1 ring-destructive/25",
    icon: AlertTriangle,
  },
  warning: {
    label: "Needs attention",
    className: "bg-warning/12 text-warning ring-1 ring-warning/25",
    icon: AlertTriangle,
  },
  optional: {
    label: "Optional",
    className: "bg-surface/80 text-muted-foreground ring-1 ring-border",
    icon: CircleHelp,
  },
};

const GROUP_ACCENTS: Record<string, string> = {
  platform: "bg-primary/12 text-primary ring-primary/25",
  auth: "bg-violet/12 text-violet ring-violet/25",
  ai: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/25 dark:text-indigo-300",
  payments: "bg-success/12 text-success ring-success/25",
  email: "bg-cyan/12 text-cyan ring-cyan/25",
  storage: "bg-primary/12 text-primary ring-primary/25",
};

const WHAT_IT_DOES = [
  {
    title: "See what is wired up",
    description:
      "Quickly check whether OpenAI, Razorpay, SMTP, database, and storage are ready before a launch or demo.",
  },
  {
    title: "Understand each setting",
    description:
      "Every row explains what the variable controls and which product flow depends on it.",
  },
  {
    title: "Safe for production",
    description:
      "API keys and passwords are never exposed — only masked values and configured / missing status.",
  },
  {
    title: "Change via environment",
    description:
      "Update .env locally or your hosting provider (Vercel, Coolify, etc.), then restart the server.",
  },
] as const;

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
        setError(payload.error ?? "Unable to load system settings.");
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

  return (
    <MasterShell
      title="System Settings"
      subtitle="Platform configuration health — integrations, secrets, and runtime environment."
      topActions={
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={`${masterBtnGhost} inline-flex items-center gap-2 !px-4 !py-2.5 disabled:opacity-60`}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh status
        </button>
      }
    >
      <div className="space-y-5">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

        <MasterHero
          badge="Platform health"
          title="System configuration"
          subtitle="Infrastructure, integrations, and runtime environment — verify everything before go-live or after a new deploy."
        />

        <MasterInfoCard title="What is System Settings?">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your platform control panel for database, AI, payments, email, and storage. Use it before
            go-live, after deploying to a new server, or when debugging integration issues. API keys
            and passwords are never exposed — only masked values and configured / missing status.
          </p>
          {data?.summary.appUrl ? (
            <p className="mt-3 text-xs text-muted-foreground">
              App URL:{" "}
              <span className="font-semibold text-foreground">{data.summary.appUrl}</span>
            </p>
          ) : null}
        </MasterInfoCard>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MasterKpiCard
            label="Health score"
            value={`${data?.summary.healthPct ?? 0}%`}
            hint={`${data?.summary.totalChecks ?? 0} checks total`}
            icon={CheckCircle2}
            accent={
              (data?.summary.healthPct ?? 0) >= 80
                ? "bg-success/12 text-success ring-success/25"
                : "bg-warning/12 text-warning ring-warning/25"
            }
          />
          <MasterKpiCard
            label="Configured"
            value={data?.summary.configuredCount ?? 0}
            icon={Settings}
            accent="bg-success/12 text-success ring-success/25"
          />
          <MasterKpiCard
            label="Missing"
            value={data?.summary.missingCount ?? 0}
            icon={AlertTriangle}
            accent="bg-destructive/12 text-destructive ring-destructive/25"
          />
          <MasterKpiCard
            label="Needs attention"
            value={data?.summary.warningCount ?? 0}
            icon={CircleHelp}
            accent="bg-warning/12 text-warning ring-warning/25"
          />
          <MasterKpiCard
            label="Environment"
            value={data?.summary.environment ?? "—"}
            hint="Runtime mode"
            icon={Server}
            accent="bg-primary/12 text-primary ring-primary/25"
          />
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <MasterCard title="Why this page exists">
            <ul className="space-y-3">
              {WHAT_IT_DOES.map((item) => (
                <li
                  key={item.title}
                  className="rounded-xl border border-border bg-surface/40 p-3"
                >
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                </li>
              ))}
            </ul>
          </MasterCard>

          <MasterCard title="How to change settings">
            <ol className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <li className="flex gap-3">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  1
                </span>
                <span className="text-foreground/90">
                  Edit{" "}
                  <code className="rounded bg-surface/80 px-1.5 py-0.5 text-xs text-foreground ring-1 ring-border">
                    .env
                  </code>{" "}
                  on your machine or set variables in your hosting dashboard (Vercel, Coolify,
                  Railway, etc.).
                </span>
              </li>
              <li className="flex gap-3">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  2
                </span>
                <span className="text-foreground/90">
                  Restart{" "}
                  <code className="rounded bg-surface/80 px-1.5 py-0.5 text-xs text-foreground ring-1 ring-border">
                    npm run dev
                  </code>{" "}
                  or redeploy production.
                </span>
              </li>
              <li className="flex gap-3">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  3
                </span>
                <span className="text-foreground/90">
                  Click <strong className="font-semibold text-foreground">Refresh status</strong>{" "}
                  above to verify the new configuration.
                </span>
              </li>
            </ol>
            <ul className="mt-5 space-y-2">
              {(data?.notes ?? []).map((note) => (
                <li
                  key={note}
                  className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2 text-xs text-foreground"
                >
                  {note}
                </li>
              ))}
            </ul>
          </MasterCard>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(data?.groups ?? []).map((group) => {
            const Icon = GROUP_ICONS[group.id] ?? Database;
            const configuredInGroup = group.items.filter((item) => item.status === "configured").length;
            return (
              <MasterInfoCard key={group.id}>
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${
                      GROUP_ACCENTS[group.id] ?? "bg-primary/12 text-primary ring-primary/25"
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-extrabold text-foreground">{group.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{group.description}</p>
                    <p className="mt-2 text-xs font-semibold text-success">
                      {configuredInGroup}/{group.items.length} configured
                    </p>
                  </div>
                </div>
              </MasterInfoCard>
            );
          })}
        </section>

        <MasterCard
          elevated
          title="Configuration checklist"
          subtitle="Full list of platform variables, status, and safe display values."
        >
          <div className="mb-6 rounded-xl border border-border bg-surface/40 p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] lg:items-end">
              <label className="block space-y-1.5">
                <span className="admin-label">Search settings</span>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Name, description, env variable, value..."
                    className={`${masterInputClass} w-full pl-10`}
                  />
                </div>
              </label>

              <label className="block space-y-1.5">
                <span className="admin-label">Status</span>
                <MasterSelect
                  value={statusInput}
                  onValueChange={(value) => setStatusInput(value as "ALL" | SettingStatus)}
                  className="w-full"
                  aria-label="Filter by status"
                  options={[
                    { value: "ALL", label: "All statuses" },
                    { value: "configured", label: "Configured" },
                    { value: "missing", label: "Missing" },
                    { value: "warning", label: "Needs attention" },
                    { value: "optional", label: "Optional" },
                  ]}
                />
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
              {(["ALL", "configured", "missing", "warning", "optional"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    setStatusInput(status);
                    setAppliedStatus(status);
                    setPage(1);
                  }}
                  className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                    appliedStatus === status
                      ? "text-primary-foreground shadow-[var(--shadow-glow)]"
                      : "bg-surface/60 text-muted-foreground ring-1 ring-border hover:text-foreground"
                  }`}
                  style={
                    appliedStatus === status ? { background: "var(--gradient-brand)" } : undefined
                  }
                >
                  {status === "ALL" ? "All statuses" : STATUS_META[status].label}
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
                {appliedStatus !== "ALL" ? (
                  <span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
                    Status: {STATUS_META[appliedStatus].label}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {loading && !flatItems.length ? (
            <div className="mb-4 space-y-2">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-14 animate-pulse rounded-xl bg-surface/60" />
              ))}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className={masterTableHeadClass}>
                  <th className="py-3 pr-4">Setting</th>
                  <th className="pr-4">Group</th>
                  <th className="pr-4">Status</th>
                  <th className="pr-4">Current value</th>
                  <th className="pr-4">Env variable</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.items.map((item) => {
                  const statusMeta = STATUS_META[item.status];
                  const StatusIcon = statusMeta.icon;
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-border transition hover:bg-surface/40"
                    >
                      <td className="py-4 pr-4">
                        <p className="font-semibold text-foreground">{item.label}</p>
                        <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                          {item.description}
                        </p>
                      </td>
                      <td className="pr-4 text-foreground/85">{item.groupTitle}</td>
                      <td className="pr-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.className}`}
                        >
                          <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="pr-4 font-medium text-foreground">{item.value}</td>
                      <td className="pr-4">
                        {item.envKey ? (
                          <code className="rounded-lg bg-surface/80 px-2 py-1 text-xs text-foreground ring-1 ring-border">
                            {item.envKey}
                          </code>
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

          {loading && flatItems.length > 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Refreshing configuration…</p>
          ) : null}
          {!loading && !filteredItems.length ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface/30 px-4 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/25">
                <Settings className="h-6 w-6" aria-hidden />
              </div>
              <p className="mt-4 text-sm font-semibold text-foreground">No settings match your filters</p>
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
