"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Clock,
  Eye,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  MASTER_PAGE_SIZE_OPTIONS,
  MasterPageSize,
  MasterPagination,
} from "@/components/master-pagination";
import { useAppFeedback } from "@/components/app-feedback";
import {
  MasterAlert,
  MasterStatusBadge,
  masterBtnGhost,
  masterBtnPrimary,
  masterInputClass,
  masterRowActionDangerClass,
  MasterRowActionsMenu,
} from "@/components/master-ui";

type StuckSession = {
  id: string;
  type: string;
  name: string;
  email: string;
  domain: string;
  status: string;
  createdAt: string;
  ageHours: number;
};

type StuckResponse = {
  liveCount: number;
  stuckCount: number;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  sessions: StuckSession[];
};

type MasterStuckSessionsPanelProps = {
  compact?: boolean;
  defaultPageSize?: MasterPageSize;
  showViewAllLink?: boolean;
  hideWhenEmpty?: boolean;
};

function formatAgeLabel(ageHours: number) {
  if (ageHours < 48) return `${ageHours}h`;
  const days = Math.floor(ageHours / 24);
  const hours = ageHours % 24;
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

function sessionTypeLabel(type: string) {
  return type === "COMPANY" ? "Company" : "Practice";
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
      const formatted =
        lower === "hr" || lower === "qa" || lower === "it" || lower === "ai"
          ? lower.toUpperCase()
          : lower.charAt(0).toUpperCase() + lower.slice(1);
      return word.replace(core, formatted);
    })
    .join(" ");
}

export function MasterStuckSessionsPanel({
  compact = false,
  defaultPageSize,
  showViewAllLink = false,
  hideWhenEmpty = compact,
}: MasterStuckSessionsPanelProps) {
  const { confirmDelete, notify } = useAppFeedback();
  const [data, setData] = useState<StuckResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<MasterPageSize>(
    defaultPageSize ?? MASTER_PAGE_SIZE_OPTIONS[0],
  );

  const [searchInput, setSearchInput] = useState("");
  const [statusInput, setStatusInput] = useState<"" | "LIVE" | "READY">("");
  const [typeInput, setTypeInput] = useState<"" | "PRACTICE" | "COMPANY">("");
  const [domainInput, setDomainInput] = useState("");
  const [minAgeInput, setMinAgeInput] = useState("");
  const [maxAgeInput, setMaxAgeInput] = useState("");
  const [fromDateInput, setFromDateInput] = useState("");
  const [toDateInput, setToDateInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedStatus, setAppliedStatus] = useState<"" | "LIVE" | "READY">("");
  const [appliedType, setAppliedType] = useState<"" | "PRACTICE" | "COMPANY">("");
  const [appliedDomain, setAppliedDomain] = useState("");
  const [appliedMinAge, setAppliedMinAge] = useState("");
  const [appliedMaxAge, setAppliedMaxAge] = useState("");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");

  const hasActiveFilters = Boolean(
    appliedSearch ||
      appliedStatus ||
      appliedType ||
      appliedDomain ||
      appliedMinAge ||
      appliedMaxAge ||
      appliedFromDate ||
      appliedToDate,
  );

  const visibleSessionIds = (data?.sessions ?? []).map((session) => session.id);
  const allVisibleSelected =
    visibleSessionIds.length > 0 && visibleSessionIds.every((id) => selectedSessionIds.has(id));
  const oldestOnPage = (data?.sessions ?? []).reduce(
    (max, session) => Math.max(max, session.ageHours),
    0,
  );

  function applyFilters() {
    setAppliedSearch(searchInput.trim());
    setAppliedStatus(statusInput);
    setAppliedType(typeInput);
    setAppliedDomain(domainInput.trim());
    setAppliedMinAge(minAgeInput.trim());
    setAppliedMaxAge(maxAgeInput.trim());
    setAppliedFromDate(fromDateInput);
    setAppliedToDate(toDateInput);
    setPage(1);
  }

  function clearFilters() {
    setSearchInput("");
    setStatusInput("");
    setTypeInput("");
    setDomainInput("");
    setMinAgeInput("");
    setMaxAgeInput("");
    setFromDateInput("");
    setToDateInput("");
    setAppliedSearch("");
    setAppliedStatus("");
    setAppliedType("");
    setAppliedDomain("");
    setAppliedMinAge("");
    setAppliedMaxAge("");
    setAppliedFromDate("");
    setAppliedToDate("");
    setPage(1);
  }

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (!compact) {
        if (appliedSearch) params.set("search", appliedSearch);
        if (appliedStatus) params.set("status", appliedStatus);
        if (appliedType) params.set("type", appliedType);
        if (appliedDomain) params.set("domain", appliedDomain);
        if (appliedMinAge) params.set("minAgeHours", appliedMinAge);
        if (appliedMaxAge) params.set("maxAgeHours", appliedMaxAge);
        if (appliedFromDate) params.set("fromDate", appliedFromDate);
        if (appliedToDate) params.set("toDate", appliedToDate);
      }

      const res = await fetch(`/api/master/sessions/stuck?${params.toString()}`, { cache: "no-store" });
      const payload = (await res.json()) as StuckResponse & { error?: string };

      if (!res.ok) {
        setError(payload.error ?? "Could not load stuck interviews.");
        return;
      }

      setData(payload);
      setSelectedSessionIds((current) => {
        const visible = new Set(payload.sessions.map((session) => session.id));
        const next = new Set<string>();
        for (const id of current) {
          if (visible.has(id)) next.add(id);
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    compact,
    appliedSearch,
    appliedStatus,
    appliedType,
    appliedDomain,
    appliedMinAge,
    appliedMaxAge,
    appliedFromDate,
    appliedToDate,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleSelectedSession(sessionId: string) {
    setSelectedSessionIds((current) => {
      const next = new Set(current);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }

  function setAllVisibleSessionsSelected(checked: boolean) {
    setSelectedSessionIds((current) => {
      const next = new Set(current);
      for (const sessionId of visibleSessionIds) {
        if (checked) next.add(sessionId);
        else next.delete(sessionId);
      }
      return next;
    });
  }

  async function updateSession(sessionId: string, action: "complete" | "reset_to_ready") {
    setUpdatingId(sessionId);
    setError("");
    try {
      const res = await fetch(`/api/master/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        setError(payload.error ?? "Could not update.");
        return;
      }
      await load();
      notify.success(action === "complete" ? "Marked complete." : "Reset to ready.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteSession(sessionId: string) {
    const ok = await confirmDelete({
      item: "stuck session",
      message: "This removes transcript, scorecard, and video permanently.",
    });
    if (!ok) return;

    setDeleteLoadingId(sessionId);
    setError("");
    try {
      const res = await fetch(`/api/master/sessions/${sessionId}`, { method: "DELETE" });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        setError(payload.error ?? "Could not delete.");
        return;
      }
      setSelectedSessionIds((current) => {
        const next = new Set(current);
        next.delete(sessionId);
        return next;
      });
      await load();
      notify.deleted("Session");
    } finally {
      setDeleteLoadingId(null);
    }
  }

  async function bulkDeleteSelectedSessions() {
    const ids = visibleSessionIds.filter((id) => selectedSessionIds.has(id));
    if (!ids.length) {
      setError("Select at least 1 session to delete.");
      return;
    }

    const ok = await confirmDelete({
      item: "stuck session",
      count: ids.length,
      message: "This removes transcripts, scorecards, and videos permanently.",
    });
    if (!ok) return;

    setBulkDeleteBusy(true);
    setError("");
    try {
      const res = await fetch("/api/master/sessions/stuck", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds: ids }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string; deletedCount?: number };
      if (!res.ok || !payload.ok) {
        setError(payload.error ?? "Could not delete selected.");
        return;
      }
      setSelectedSessionIds(new Set());
      await load();
      notify.deleted(
        `${payload.deletedCount ?? ids.length} session${(payload.deletedCount ?? ids.length) === 1 ? "" : "s"}`,
      );
    } finally {
      setBulkDeleteBusy(false);
    }
  }

  const isEmpty =
    !loading && !(data?.sessions.length ?? 0) && !(data?.liveCount ?? 0) && !(data?.stuckCount ?? 0);

  if (hideWhenEmpty && isEmpty) {
    return null;
  }

  const sessionList = (
    <>
      {!compact && (data?.sessions.length ?? 0) > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 px-1">
          <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={(event) => setAllVisibleSessionsSelected(event.currentTarget.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40"
              aria-label="Select all stuck sessions on this page"
            />
            Select all on page
          </label>
          <p className="text-xs text-muted-foreground">
            Selected: <span className="font-bold text-foreground">{selectedSessionIds.size}</span>
          </p>
          <button
            type="button"
            onClick={() => void bulkDeleteSelectedSessions()}
            disabled={bulkDeleteBusy || selectedSessionIds.size === 0}
            className={`${masterRowActionDangerClass} inline-flex items-center gap-1.5 disabled:opacity-50`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {bulkDeleteBusy ? "Deleting…" : "Delete selected"}
          </button>
        </div>
      ) : null}

      <div className="space-y-2">
        {(data?.sessions ?? []).map((session) => {
          const rowBusy = updatingId === session.id || deleteLoadingId === session.id;
          const isCritical = session.ageHours >= 24;

          return (
            <article
              key={session.id}
              className={`rounded-xl border px-3 py-2.5 transition sm:px-4 ${
                isCritical
                  ? "border-warning/35 bg-warning/5 ring-1 ring-warning/20"
                  : "border-border bg-surface/30"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {!compact ? (
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={selectedSessionIds.has(session.id)}
                        onChange={() => toggleSelectedSession(session.id)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40"
                        aria-label={`Select ${session.name}`}
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{session.name}</p>
                      <MasterStatusBadge status={session.status} />
                      {isCritical ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold uppercase text-warning ring-1 ring-warning/25">
                          <AlertTriangle className="h-3 w-3" aria-hidden />
                          Critical
                        </span>
                      ) : null}
                    </div>
                    {session.email ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">{session.email}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground/80">{sessionTypeLabel(session.type)}</span>
                      <span>{formatInterviewTopic(session.domain)}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden />
                        {formatAgeLabel(session.ageHours)} old
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <MasterRowActionsMenu
                    label={session.name}
                    actions={[
                      {
                        label: "Complete",
                        onClick: () => void updateSession(session.id, "complete"),
                        disabled: rowBusy,
                      },
                      {
                        label: "Reset",
                        onClick: () => void updateSession(session.id, "reset_to_ready"),
                        disabled: rowBusy,
                      },
                      {
                        label: "Delete",
                        onClick: () => void deleteSession(session.id),
                        danger: true,
                        disabled: rowBusy || bulkDeleteBusy,
                      },
                    ]}
                  />
                </div>
              </div>
            </article>
          );
        })}

        {!loading && !data?.sessions.length ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
            <p className="text-sm font-semibold text-foreground">No stuck interviews</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasActiveFilters ? "Try different filters." : "Nothing needs attention."}
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
      </div>

      {(data?.pagination.total ?? 0) > 0 ? (
        <MasterPagination
          page={page}
          pageSize={pageSize}
          totalItems={data?.pagination.total ?? data?.stuckCount ?? 0}
          itemLabel="stuck interviews"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      ) : null}
    </>
  );

  if (compact) {
    const preview = (data?.sessions ?? []).slice(0, 6);
    return (
      <section className="admin-card border-warning/30 bg-warning/5 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="admin-section-title text-sm">Stuck interviews</p>
            <p className="text-[11px] text-muted-foreground">
              {data?.liveCount ?? 0} live · {data?.stuckCount ?? 0} stuck
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {showViewAllLink ? (
              <Link
                href="/master/stuck-sessions"
                className={`${masterBtnGhost} inline-flex items-center gap-1 !px-2.5 !py-1 !text-xs`}
              >
                <Eye className="h-3.5 w-3.5" />
                View all
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className={`${masterBtnGhost} inline-flex items-center gap-1.5 !px-2.5 !py-1 !text-xs disabled:opacity-60`}
              aria-label="Refresh"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        {error ? <MasterAlert variant="error" className="mb-2">{error}</MasterAlert> : null}
        {loading && !data?.sessions.length ? (
          <div className="space-y-1.5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-10 animate-pulse rounded-lg bg-surface/60" />
            ))}
          </div>
        ) : preview.length ? (
          <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {preview.map((session) => {
              const rowBusy = updatingId === session.id || deleteLoadingId === session.id;
              const isCritical = session.ageHours >= 24;
              return (
                <article
                  key={session.id}
                  className={`flex items-center gap-2 px-2.5 py-1.5 ${
                    isCritical ? "bg-warning/10" : "bg-surface/40"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-foreground">{session.name}</p>
                      <MasterStatusBadge status={session.status} />
                      {isCritical ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-warning ring-1 ring-warning/25">
                          <AlertTriangle className="h-3 w-3" aria-hidden />
                          Critical
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[
                        session.email,
                        sessionTypeLabel(session.type),
                        formatInterviewTopic(session.domain),
                        `${formatAgeLabel(session.ageHours)} old`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <MasterRowActionsMenu
                    label={session.name}
                    actions={[
                      {
                        label: "Complete",
                        onClick: () => void updateSession(session.id, "complete"),
                        disabled: rowBusy,
                      },
                      {
                        label: "Reset",
                        onClick: () => void updateSession(session.id, "reset_to_ready"),
                        disabled: rowBusy,
                      },
                      {
                        label: "Delete",
                        onClick: () => void deleteSession(session.id),
                        danger: true,
                        disabled: rowBusy || bulkDeleteBusy,
                      },
                    ]}
                  />
                </article>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
            No stuck interviews.
          </p>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

      <section className="grid gap-2 sm:grid-cols-3">
        <article className="admin-card flex items-center justify-between gap-2 p-3">
          <div>
            <p className="text-xs text-muted-foreground">Live</p>
            <p className="text-xl font-semibold text-foreground">{data?.liveCount ?? 0}</p>
          </div>
          <Activity className="h-4 w-4 text-destructive" aria-hidden />
        </article>
        <article className="admin-card flex items-center justify-between gap-2 p-3">
          <div>
            <p className="text-xs text-muted-foreground">Stuck</p>
            <p className="text-xl font-semibold text-foreground">{data?.stuckCount ?? 0}</p>
          </div>
          <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
        </article>
        <article className="admin-card flex items-center justify-between gap-2 p-3">
          <div>
            <p className="text-xs text-muted-foreground">Oldest</p>
            <p className="text-xl font-semibold text-foreground">
              {oldestOnPage > 0 ? formatAgeLabel(oldestOnPage) : "—"}
            </p>
          </div>
          <Clock className="h-4 w-4 text-primary" aria-hidden />
        </article>
      </section>

      <section className="admin-card overflow-hidden">
        <div className="space-y-3 p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
            <label className="block space-y-1">
              <span className="admin-label">Search</span>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyFilters();
                  }}
                  placeholder="Name or email"
                  className={`${masterInputClass} w-full pl-10`}
                />
              </div>
            </label>

            <label className="block space-y-1">
              <span className="admin-label">Track</span>
              <input
                value={domainInput}
                onChange={(event) => setDomainInput(event.target.value)}
                placeholder="Engineering"
                className={`${masterInputClass} w-full`}
              />
            </label>

            <label className="block space-y-1">
              <span className="admin-label">Stuck for (hours)</span>
              <input
                type="number"
                min={1}
                value={minAgeInput}
                onChange={(event) => setMinAgeInput(event.target.value)}
                placeholder="1"
                className={`${masterInputClass} w-full`}
              />
            </label>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={applyFilters}
                className={`${masterBtnPrimary} inline-flex h-10 flex-1 items-center justify-center gap-2 !px-4`}
              >
                <Search className="h-4 w-4" aria-hidden />
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
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>

            <label className="block space-y-1">
              <span className="admin-label">From</span>
              <input
                type="date"
                value={fromDateInput}
                onChange={(event) => setFromDateInput(event.target.value)}
                className={`${masterInputClass} w-full`}
              />
            </label>
            <label className="block space-y-1">
              <span className="admin-label">To</span>
              <input
                type="date"
                value={toDateInput}
                onChange={(event) => setToDateInput(event.target.value)}
                className={`${masterInputClass} w-full`}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(["", "LIVE", "READY"] as const).map((status) => (
              <button
                key={status || "all"}
                type="button"
                onClick={() => {
                  setStatusInput(status);
                  setAppliedStatus(status);
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  appliedStatus === status
                    ? "text-primary-foreground"
                    : "bg-surface/60 text-muted-foreground ring-1 ring-border hover:text-foreground"
                }`}
                style={appliedStatus === status ? { background: "var(--gradient-brand)" } : undefined}
              >
                {status === "" ? "All" : status === "LIVE" ? "Live" : "Ready"}
              </button>
            ))}
            {(["", "PRACTICE", "COMPANY"] as const).map((type) => (
              <button
                key={type || "all-types"}
                type="button"
                onClick={() => {
                  setTypeInput(type);
                  setAppliedType(type);
                  setPage(1);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  appliedType === type
                    ? "text-primary-foreground"
                    : "bg-surface/60 text-muted-foreground ring-1 ring-border hover:text-foreground"
                }`}
                style={appliedType === type ? { background: "var(--gradient-brand)" } : undefined}
              >
                {type === "" ? "All types" : sessionTypeLabel(type)}
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 pb-3">
          {loading && !data?.sessions.length ? (
            <div className="space-y-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-14 animate-pulse rounded-xl bg-surface/60" />
              ))}
            </div>
          ) : (
            sessionList
          )}
        </div>
      </section>
    </div>
  );
}
