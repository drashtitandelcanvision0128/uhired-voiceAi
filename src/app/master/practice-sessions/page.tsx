"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, CreditCard, Eye, RefreshCw, ScrollText, Search, TrendingUp, X } from "lucide-react";
import { useConfirm, useToast } from "@/components/app-feedback";
import { MasterShell } from "@/components/master-shell";
import {
  MASTER_PAGE_SIZE_OPTIONS,
  MasterPageSize,
  MasterPagination,
} from "@/components/master-pagination";
import { MasterPracticeSessionDetailModal } from "@/components/master-practice-session-detail-modal";
import {
  MasterAlert,
  MasterCard,
  MasterHero,
  MasterKpiCard,
  MasterSelect,
  masterBtnGhost,
  masterBtnPrimary,
  masterInputClass,
  MasterRowActionsMenu,
  masterTableHeadClass,
} from "@/components/master-ui";

type PracticeResponse = {
  metrics: {
    totalSessions: number;
    avgPerformance: number;
    revenueStream: number;
    activeNow: number;
  };
  rows: Array<{
    id: string;
    candidateName: string;
    candidateEmail: string;
    track: string;
    status: string;
    durationLabel: string;
    score: number | null;
    paymentType: "PAID" | "PROMO" | "UNPAID";
    createdAt: string;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

const inrCurrencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

type PracticeSessionDetails = {
  session: {
    id: string;
    candidateName: string | null;
    candidateEmail: string | null;
    status: string;
    domain: string;
    topic: string;
    durationMin: number;
    createdAt: string;
    scoringJobStatus?: "PENDING" | "SUBMITTED" | "COMPLETED" | "FAILED" | null;
    scorecard: {
      overallScore: number;
      communication: number;
      domainDepth: number;
      confidence: number;
      summary: string;
      strengths?: string[] | null;
      improvements?: string[] | null;
      evidence?: string[] | null;
      scoringMode?: string | null;
      scoringModel?: string | null;
    } | null;
    transcript: Array<{
      id: string;
      speaker: "CANDIDATE" | "INTERVIEWER";
      message: string;
      orderIndex: number;
      timestampMs: number | null;
      createdAt: string;
    }>;
  };
};

export default function MasterPracticeSessionsPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const searchParams = useSearchParams();
  const [data, setData] = useState<PracticeResponse | null>(null);
  const [error, setError] = useState("");
  const [details, setDetails] = useState<PracticeSessionDetails["session"] | null>(null);
  const [detailsLoadingId, setDetailsLoadingId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<MasterPageSize>(MASTER_PAGE_SIZE_OPTIONS[0]);
  const [searchInput, setSearchInput] = useState("");
  const [statusInput, setStatusInput] = useState<"" | "READY" | "LIVE" | "COMPLETED">("");
  const [paymentInput, setPaymentInput] = useState<"" | "PAID" | "PROMO" | "UNPAID">("");
  const [trackInput, setTrackInput] = useState("");
  const [fromDateInput, setFromDateInput] = useState("");
  const [toDateInput, setToDateInput] = useState("");
  const [scoreMinInput, setScoreMinInput] = useState("");
  const [scoreMaxInput, setScoreMaxInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedStatus, setAppliedStatus] = useState<"" | "READY" | "LIVE" | "COMPLETED">("");
  const [appliedPayment, setAppliedPayment] = useState<"" | "PAID" | "PROMO" | "UNPAID">("");
  const [appliedTrack, setAppliedTrack] = useState("");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");
  const [appliedScoreMin, setAppliedScoreMin] = useState("");
  const [appliedScoreMax, setAppliedScoreMax] = useState("");

  const hasActiveFilters = Boolean(
    appliedSearch ||
      appliedStatus ||
      appliedPayment ||
      appliedTrack ||
      appliedFromDate ||
      appliedToDate ||
      appliedScoreMin ||
      appliedScoreMax,
  );

  function applyFilters() {
    setAppliedSearch(searchInput.trim());
    setAppliedStatus(statusInput);
    setAppliedPayment(paymentInput);
    setAppliedTrack(trackInput.trim());
    setAppliedFromDate(fromDateInput);
    setAppliedToDate(toDateInput);
    setAppliedScoreMin(scoreMinInput.trim());
    setAppliedScoreMax(scoreMaxInput.trim());
    setPage(1);
  }

  function clearFilters() {
    setSearchInput("");
    setStatusInput("");
    setPaymentInput("");
    setTrackInput("");
    setFromDateInput("");
    setToDateInput("");
    setScoreMinInput("");
    setScoreMaxInput("");
    setAppliedSearch("");
    setAppliedStatus("");
    setAppliedPayment("");
    setAppliedTrack("");
    setAppliedFromDate("");
    setAppliedToDate("");
    setAppliedScoreMin("");
    setAppliedScoreMax("");
    setPage(1);
  }

  const load = useCallback(async () => {
    setError("");
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (appliedSearch) params.set("search", appliedSearch);
    if (appliedStatus) params.set("status", appliedStatus);
    if (appliedPayment) params.set("payment", appliedPayment);
    if (appliedTrack) params.set("track", appliedTrack);
    if (appliedFromDate) params.set("fromDate", appliedFromDate);
    if (appliedToDate) params.set("toDate", appliedToDate);
    if (appliedScoreMin) params.set("scoreMin", appliedScoreMin);
    if (appliedScoreMax) params.set("scoreMax", appliedScoreMax);
    const res = await fetch(`/api/master/practice-sessions?${params.toString()}`);
    const payload = (await res.json()) as PracticeResponse & { error?: string };
    if (res.status === 401) {
      router.push("/master-login");
      return;
    }
    if (!res.ok) {
      setError(payload.error ?? "Unable to load practice logs.");
      return;
    }
    setData(payload);
  }, [
    router,
    page,
    pageSize,
    appliedSearch,
    appliedStatus,
    appliedPayment,
    appliedTrack,
    appliedFromDate,
    appliedToDate,
    appliedScoreMin,
    appliedScoreMax,
  ]);

  const viewDetails = useCallback(
    async (sessionId: string) => {
      setDetails(null);
      setDetailsLoadingId(sessionId);
      setError("");
      try {
        const res = await fetch(`/api/master/practice-sessions/${sessionId}`);
        const payload = (await res.json()) as PracticeSessionDetails & { error?: string };
        if (res.status === 401) {
          router.push("/master-login");
          return;
        }
        if (!res.ok) {
          setError(payload.error ?? "Unable to load session details.");
          return;
        }
        setDetails(payload.session);
      } finally {
        setDetailsLoadingId(null);
      }
    },
    [router],
  );

  const closeDetails = useCallback(() => {
    setDetails(null);
    setDetailsLoadingId(null);
    const params = new URLSearchParams(searchParams.toString());
    if (params.has("sessionId")) {
      params.delete("sessionId");
      const query = params.toString();
      router.replace(
        query ? `/master/practice-sessions?${query}` : "/master/practice-sessions",
        { scroll: false },
      );
    }
  }, [router, searchParams]);

  useEffect(() => {
    const sessionId = searchParams.get("sessionId");
    if (sessionId) {
      void viewDetails(sessionId);
    }
  }, [searchParams, viewDetails]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteSession(sessionId: string) {
    const ok = await confirm({
      title: "Delete practice session?",
      message: "This permanently removes the session and all related data. This action cannot be undone.",
      confirmLabel: "Delete session",
      variant: "danger",
    });
    if (!ok) {
      return;
    }

    setError("");
    setDeleteLoadingId(sessionId);
    try {
      const res = await fetch(`/api/master/practice-sessions/${sessionId}`, { method: "DELETE" });
      const payload = (await res.json()) as { error?: string };
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok) {
        setError(payload.error ?? "Unable to delete session.");
        return;
      }

      if (details?.id === sessionId) {
        closeDetails();
      }
      toast.success("Practice session deleted successfully.");
      await load();
    } finally {
      setDeleteLoadingId(null);
    }
  }

  return (
    <MasterShell
      title="Practice Interviews"
      subtitle="Monitor, analyze, and manage candidate practice interviews in real time."
      topActions={
        <button
          type="button"
          onClick={() => void load()}
          className="admin-btn-ghost inline-flex items-center gap-2 !px-4 !py-2.5"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      }
    >
      <div className="space-y-5">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

        {details !== null || detailsLoadingId !== null ? (
          <MasterPracticeSessionDetailModal
            open
            loading={detailsLoadingId !== null && details === null}
            session={details}
            onClose={closeDetails}
            onDelete={(sessionId) => void deleteSession(sessionId)}
            deleteBusy={details !== null && deleteLoadingId === details.id}
          />
        ) : (
        <>
        <MasterHero
          badge="Practice interviews"
          title="Practice interview monitoring"
          subtitle="Track candidate performance, revenue, and live session activity across all practice interviews."
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MasterKpiCard
            label="Total Sessions"
            value={data?.metrics.totalSessions ?? 0}
            icon={ScrollText}
            accent="bg-primary/12 text-primary"
          />
          <MasterKpiCard
            label="Avg. Performance"
            value={`${(data?.metrics.avgPerformance ?? 0).toFixed(1)}%`}
            icon={TrendingUp}
            accent="bg-violet/12 text-violet"
          />
          <MasterKpiCard
            label="Revenue Stream"
            value={inrCurrencyFormatter.format(data?.metrics.revenueStream ?? 0)}
            icon={CreditCard}
            accent="bg-success/12 text-success"
          />
          <MasterKpiCard
            label="Active Now"
            value={data?.metrics.activeNow ?? 0}
            icon={Activity}
            accent="bg-cyan/12 text-cyan"
          />
        </section>

        <MasterCard elevated title="Practice sessions" subtitle="Filter by candidate, status, payment, track, date, or score.">
          <div className="mb-4 rounded-xl border border-border bg-surface/40 p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
              <label className="block space-y-1.5">
                <span className="admin-label">Search sessions</span>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") applyFilters();
                    }}
                    placeholder="Candidate name, email, track..."
                    className={`${masterInputClass} w-full pl-10`}
                  />
                </div>
              </label>

              <label className="block space-y-1.5">
                <span className="admin-label">Status</span>
                <MasterSelect
                  value={statusInput}
                  onValueChange={(value) =>
                    setStatusInput(value as "" | "READY" | "LIVE" | "COMPLETED")
                  }
                  className="w-full"
                  aria-label="Filter by status"
                  options={[
                    { value: "", label: "All statuses" },
                    { value: "LIVE", label: "LIVE" },
                    { value: "READY", label: "READY" },
                    { value: "COMPLETED", label: "COMPLETED" },
                  ]}
                />
              </label>

              <label className="block space-y-1.5">
                <span className="admin-label">Payment</span>
                <MasterSelect
                  value={paymentInput}
                  onValueChange={(value) =>
                    setPaymentInput(value as "" | "PAID" | "PROMO" | "UNPAID")
                  }
                  className="w-full"
                  aria-label="Filter by payment"
                  options={[
                    { value: "", label: "All payments" },
                    { value: "PAID", label: "Paid" },
                    { value: "PROMO", label: "Promo" },
                    { value: "UNPAID", label: "Unpaid" },
                  ]}
                />
              </label>

              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={applyFilters}
                  className={`${masterBtnPrimary} inline-flex h-[2.75rem] flex-1 items-center justify-center gap-2 !px-4`}
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Search
                </button>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className={`${masterBtnGhost} inline-flex h-[2.75rem] items-center justify-center gap-2 !px-4`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Clear
                  </button>
                ) : null}
              </div>

              <label className="block space-y-1.5">
                <span className="admin-label">Track / domain</span>
                <input
                  value={trackInput}
                  onChange={(event) => setTrackInput(event.target.value)}
                  placeholder="e.g. Engineering, UI/UX"
                  className={`${masterInputClass} w-full`}
                />
              </label>

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

              <div className="grid grid-cols-2 gap-3">
                <label className="block min-w-0 space-y-1.5">
                  <span className="admin-label">Min score</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={scoreMinInput}
                    onChange={(event) => setScoreMinInput(event.target.value)}
                    placeholder="0"
                    className={`${masterInputClass} w-full`}
                  />
                </label>
                <label className="block min-w-0 space-y-1.5">
                  <span className="admin-label">Max score</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={scoreMaxInput}
                    onChange={(event) => setScoreMaxInput(event.target.value)}
                    placeholder="100"
                    className={`${masterInputClass} w-full`}
                  />
                </label>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(["", "LIVE", "COMPLETED", "READY"] as const).map((status) => (
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
                {appliedStatus ? (
                  <span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
                    Status: {appliedStatus}
                  </span>
                ) : null}
                {appliedPayment ? (
                  <span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
                    Payment: {appliedPayment}
                  </span>
                ) : null}
                {appliedTrack ? (
                  <span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
                    Track: {appliedTrack}
                  </span>
                ) : null}
                {appliedFromDate ? (
                  <span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
                    From: {appliedFromDate}
                  </span>
                ) : null}
                {appliedToDate ? (
                  <span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
                    To: {appliedToDate}
                  </span>
                ) : null}
                {appliedScoreMin ? (
                  <span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
                    Min score: {appliedScoreMin}
                  </span>
                ) : null}
                {appliedScoreMax ? (
                  <span className="rounded-full bg-surface/80 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
                    Max score: {appliedScoreMax}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className={masterTableHeadClass}>
                  <th className="py-2 pr-3">Date / Time</th>
                  <th className="pr-3">Candidate</th>
                  <th className="pr-3">Track</th>
                  <th className="pr-3">Status</th>
                  <th className="pr-3">Duration</th>
                  <th className="pr-3">AI Score</th>
                  <th className="pr-3">Payment</th>
                  <th className="w-10 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-border transition hover:bg-surface/40">
                    <td className="py-3 pr-3 text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="pr-3">
                      <p className="font-semibold text-foreground">{row.candidateName}</p>
                      <p className="text-xs text-muted-foreground">{row.candidateEmail}</p>
                    </td>
                    <td className="pr-3">
                      <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-bold uppercase text-primary ring-1 ring-primary/25">
                        {row.track}
                      </span>
                    </td>
                    <td className="pr-3 text-xs font-semibold text-foreground">{row.status}</td>
                    <td className="pr-3 text-foreground/85">{row.durationLabel}</td>
                    <td className="pr-3 font-medium text-foreground">{row.score ?? "—"}</td>
                    <td className="pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${
                          row.paymentType === "PAID"
                            ? "bg-success/12 text-success ring-success/25"
                            : row.paymentType === "PROMO"
                              ? "bg-indigo-500/15 text-indigo-700 ring-indigo-500/25 dark:text-indigo-300"
                              : "bg-surface/80 text-muted-foreground ring-border"
                        }`}
                      >
                        {row.paymentType}
                      </span>
                    </td>
                    <td className="text-right">
                      <MasterRowActionsMenu
                        label={row.candidateName}
                        actions={[
                          {
                            label: detailsLoadingId === row.id ? "Loading..." : "View",
                            icon: Eye,
                            onClick: () => void viewDetails(row.id),
                            disabled: detailsLoadingId === row.id,
                          },
                          {
                            label: deleteLoadingId === row.id ? "Deleting..." : "Delete",
                            onClick: () => void deleteSession(row.id),
                            danger: true,
                            disabled: deleteLoadingId === row.id,
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <MasterPagination
            page={page}
            pageSize={pageSize}
            totalItems={data?.pagination.total ?? 0}
            itemLabel="sessions"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </MasterCard>
        </>
        )}
      </div>
    </MasterShell>
  );
}
