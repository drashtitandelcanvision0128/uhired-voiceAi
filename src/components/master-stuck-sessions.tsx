"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Clock,
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
  MasterCard,
  MasterHero,
  MasterInlineKpi,
  MasterKpiCard,
  MasterStatusBadge,
  masterBtnGhost,
  masterBtnPrimary,
  masterInputClass,
  masterRowActionDangerClass,
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
        setError(payload.error ?? "Unable to load stuck sessions.");
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
        setError(payload.error ?? "Unable to update session.");
        return;
      }
      await load();
      notify.success(action === "complete" ? "Session marked as complete." : "Session reset to ready.");
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
        setError(payload.error ?? "Unable to delete session.");
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
        setError(payload.error ?? "Unable to delete selected sessions.");
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
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/40 px-4 py-3">
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

      <div className="space-y-3">
        {(data?.sessions ?? []).map((session) => {
          const rowBusy = updatingId === session.id || deleteLoadingId === session.id;
          const isCritical = session.ageHours >= 24;

          return (
            <article
              key={session.id}
              className={`glow-card rounded-2xl border px-4 py-4 transition-all sm:px-5 ${
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
                      <span>{session.domain}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden />
                        {formatAgeLabel(session.ageHours)} old
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={rowBusy}
                    onClick={() => void updateSession(session.id, "complete")}
                    className={`${masterBtnPrimary} !px-3 !py-1.5 !text-xs disabled:opacity-50`}
                  >
                    Force complete
                  </button>
                  <button
                    type="button"
                    disabled={rowBusy}
                    onClick={() => void updateSession(session.id, "reset_to_ready")}
                    className={`${masterBtnGhost} !px-3 !py-1.5 !text-xs disabled:opacity-50`}
                  >
                    Reset to ready
                  </button>
                  <button
                    type="button"
                    disabled={rowBusy || bulkDeleteBusy}
                    onClick={() => void deleteSession(session.id)}
                    className={`${masterRowActionDangerClass} disabled:opacity-50`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {!loading && !data?.sessions.length ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface/30 px-6 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-success/12 text-success ring-1 ring-success/25">
              <Activity className="h-6 w-6" aria-hidden />
            </div>
            <p className="mt-4 text-base font-bold text-foreground">No stuck sessions found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasActiveFilters
                ? "Try adjusting your filters or clear them to see all stuck sessions."
                : "All sessions are progressing normally — nothing needs attention right now."}
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
          itemLabel="stuck sessions"
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
    return (
      <MasterCard
        className="border-warning/30 bg-warning/5"
        title="Stuck sessions"
        subtitle={`${data?.liveCount ?? 0} live · ${data?.stuckCount ?? 0} older than 1 hour`}
        headerAction={
          <div className="flex flex-wrap items-center gap-2">
            {showViewAllLink ? (
              <Link
                href="/master/stuck-sessions"
                className={`${masterBtnGhost} inline-flex items-center gap-1 !px-3 !py-1.5 !text-xs`}
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className={`${masterBtnGhost} inline-flex items-center gap-2 !px-3 !py-1.5 !text-xs disabled:opacity-60`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        }
      >
        {error ? <MasterAlert variant="error" className="mb-4">{error}</MasterAlert> : null}
        {loading && !data?.sessions.length ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 animate-pulse rounded-2xl bg-surface/60" />
            ))}
          </div>
        ) : (
          sessionList
        )}
      </MasterCard>
    );
  }

  return (
    <div className="space-y-5">
      {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

      <MasterHero
        badge="Session recovery"
        title="Stuck session monitoring"
        subtitle="Sessions stuck in LIVE or READY for more than 1 hour — review, force-complete, or clean up safely."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/15 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <MasterInlineKpi label="Live now" value={data?.liveCount ?? 0} />
          <MasterInlineKpi label="Stuck (>1h)" value={data?.stuckCount ?? 0} />
          <MasterInlineKpi
            label="Oldest on page"
            value={oldestOnPage > 0 ? formatAgeLabel(oldestOnPage) : "—"}
          />
        </div>
      </MasterHero>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MasterKpiCard
          label="Live Sessions"
          value={data?.liveCount ?? 0}
          hint="Across the platform right now"
          icon={Activity}
          accent="bg-destructive/12 text-destructive ring-destructive/25"
        />
        <MasterKpiCard
          label="Stuck Sessions"
          value={data?.stuckCount ?? 0}
          hint="LIVE or READY older than 1 hour"
          icon={AlertTriangle}
          accent="bg-warning/12 text-warning ring-warning/25"
        />
        <MasterKpiCard
          label="On This Page"
          value={data?.sessions.length ?? 0}
          hint={`Page ${data?.pagination.page ?? 1} of ${data?.pagination.totalPages ?? 1}`}
          icon={Clock}
          accent="bg-primary/12 text-primary ring-primary/25"
        />
        <MasterKpiCard
          label="Selected"
          value={selectedSessionIds.size}
          hint="Ready for bulk actions"
          icon={Trash2}
          accent="bg-violet/12 text-violet ring-violet/25"
        />
      </section>

      <MasterCard
        elevated
        title="Stuck sessions"
        subtitle="Filter by candidate, status, type, domain, age, or date range."
      >
        <div className="mb-5 rounded-xl border border-border bg-surface/40 p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
            <label className="block space-y-1.5">
              <span className="admin-label">Search sessions</span>
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
                  placeholder="Candidate name, email, company..."
                  className={`${masterInputClass} w-full pl-10`}
                />
              </div>
            </label>

            <label className="block space-y-1.5">
              <span className="admin-label">Status</span>
              <select
                value={statusInput}
                onChange={(event) =>
                  setStatusInput(event.target.value as "" | "LIVE" | "READY")
                }
                className={`${masterInputClass} w-full`}
              >
                <option value="">All stuck statuses</option>
                <option value="LIVE">LIVE</option>
                <option value="READY">READY</option>
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="admin-label">Session type</span>
              <select
                value={typeInput}
                onChange={(event) =>
                  setTypeInput(event.target.value as "" | "PRACTICE" | "COMPANY")
                }
                className={`${masterInputClass} w-full`}
              >
                <option value="">All types</option>
                <option value="PRACTICE">Practice</option>
                <option value="COMPANY">Company</option>
              </select>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applyFilters}
                className={`${masterBtnPrimary} inline-flex items-center gap-2 !px-5`}
              >
                <Search className="h-4 w-4" aria-hidden />
                Search
              </button>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className={`${masterBtnGhost} inline-flex items-center gap-2 !px-4`}
                >
                  <X className="h-4 w-4" aria-hidden />
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="block space-y-1.5">
              <span className="admin-label">Domain / track</span>
              <input
                value={domainInput}
                onChange={(event) => setDomainInput(event.target.value)}
                placeholder="e.g. Engineering"
                className={`${masterInputClass} w-full`}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="admin-label">Min age (hours)</span>
              <input
                type="number"
                min={1}
                value={minAgeInput}
                onChange={(event) => setMinAgeInput(event.target.value)}
                placeholder="1"
                className={`${masterInputClass} w-full`}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="admin-label">Max age (hours)</span>
              <input
                type="number"
                min={1}
                value={maxAgeInput}
                onChange={(event) => setMaxAgeInput(event.target.value)}
                placeholder="Optional"
                className={`${masterInputClass} w-full`}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="admin-label">From date</span>
                <input
                  type="date"
                  value={fromDateInput}
                  onChange={(event) => setFromDateInput(event.target.value)}
                  className={`${masterInputClass} w-full`}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="admin-label">To date</span>
                <input
                  type="date"
                  value={toDateInput}
                  onChange={(event) => setToDateInput(event.target.value)}
                  className={`${masterInputClass} w-full`}
                />
              </label>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(["", "LIVE", "READY"] as const).map((status) => (
              <button
                key={status || "all"}
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
                {status === "" ? "All" : status}
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
                className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                  appliedType === type
                    ? "text-primary-foreground shadow-[var(--shadow-glow)]"
                    : "bg-surface/60 text-muted-foreground ring-1 ring-border hover:text-foreground"
                }`}
                style={
                  appliedType === type ? { background: "var(--gradient-brand)" } : undefined
                }
              >
                {type === "" ? "All types" : sessionTypeLabel(type)}
              </button>
            ))}
          </div>

          {hasActiveFilters ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Active filters
              </span>
              {appliedSearch ? (
                <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-primary/25">
                  Search: {appliedSearch}
                </span>
              ) : null}
              {appliedStatus ? (
                <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-primary/25">
                  Status: {appliedStatus}
                </span>
              ) : null}
              {appliedType ? (
                <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-primary/25">
                  Type: {sessionTypeLabel(appliedType)}
                </span>
              ) : null}
              {appliedDomain ? (
                <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-primary/25">
                  Domain: {appliedDomain}
                </span>
              ) : null}
              {appliedMinAge ? (
                <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-primary/25">
                  Min age: {appliedMinAge}h
                </span>
              ) : null}
              {appliedMaxAge ? (
                <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-primary/25">
                  Max age: {appliedMaxAge}h
                </span>
              ) : null}
              {appliedFromDate ? (
                <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-primary/25">
                  From: {appliedFromDate}
                </span>
              ) : null}
              {appliedToDate ? (
                <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-primary/25">
                  To: {appliedToDate}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {loading && !data?.sessions.length ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-24 animate-pulse rounded-2xl bg-surface/60" />
            ))}
          </div>
        ) : (
          sessionList
        )}
      </MasterCard>
    </div>
  );
}
