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
import {
  MasterAlert,
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

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPayment(payment: "PAID" | "PROMO" | "UNPAID") {
  if (payment === "PAID") return "Paid";
  if (payment === "PROMO") return "Promo";
  return "Unpaid";
}

const inrCurrencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

export default function MasterPracticeSessionsPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const searchParams = useSearchParams();
  const [data, setData] = useState<PracticeResponse | null>(null);
  const [error, setError] = useState("");
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
        setError(payload.error ?? "Could not load sessions.");
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

  useEffect(() => {
    const sessionId = searchParams.get("sessionId");
    if (sessionId) {
      router.replace(`/master/practice-sessions/${sessionId}`);
    }
  }, [router, searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteSession(sessionId: string) {
    const ok = await confirm({
      title: "Delete this session?",
      message: "This cannot be undone.",
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
        setError(payload.error ?? "Could not delete this session.");
        return;
      }

      toast.success("Session deleted.");
      await load();
    } finally {
      setDeleteLoadingId(null);
    }
  }

  return (
    <MasterShell title="Practice interviews" subtitle="Candidates practising on Uhired.">
      <div className="space-y-3">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MasterKpiCard
            label="Sessions"
            value={data?.metrics.totalSessions ?? 0}
            icon={ScrollText}
            accent="bg-primary/12 text-primary"
          />
          <MasterKpiCard
            label="Avg score"
            value={`${(data?.metrics.avgPerformance ?? 0).toFixed(1)}%`}
            icon={TrendingUp}
            accent="bg-violet/12 text-violet"
          />
          <MasterKpiCard
            label="Revenue"
            value={inrCurrencyFormatter.format(data?.metrics.revenueStream ?? 0)}
            icon={CreditCard}
            accent="bg-success/12 text-success"
          />
          <MasterKpiCard
            label="Live now"
            value={data?.metrics.activeNow ?? 0}
            icon={Activity}
            accent="bg-cyan/12 text-cyan"
          />
        </section>

        <section className="admin-card overflow-hidden">
          <div className="space-y-3 p-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4 xl:items-end">
              <label className="block space-y-1">
                <span className="admin-label">Search</span>
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
                    placeholder="Name or email"
                    className={`${masterInputClass} w-full pl-10`}
                  />
                </div>
              </label>

              <label className="block space-y-1">
                <span className="admin-label">Payment</span>
                <MasterSelect
                  value={paymentInput}
                  onValueChange={(value) =>
                    setPaymentInput(value as "" | "PAID" | "PROMO" | "UNPAID")
                  }
                  className="w-full"
                  aria-label="Filter by payment"
                  options={[
                    { value: "", label: "All" },
                    { value: "PAID", label: "Paid" },
                    { value: "PROMO", label: "Promo" },
                    { value: "UNPAID", label: "Unpaid" },
                  ]}
                />
              </label>

              <label className="block space-y-1">
                <span className="admin-label">Track</span>
                <input
                  value={trackInput}
                  onChange={(event) => setTrackInput(event.target.value)}
                  placeholder="Engineering, UI/UX"
                  className={`${masterInputClass} w-full`}
                />
              </label>

              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={applyFilters}
                  className={`${masterBtnPrimary} inline-flex h-10 flex-1 items-center justify-center gap-2 !px-4`}
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Search
                </button>
                <button
                  type="button"
                  onClick={() => void load()}
                  className={`${masterBtnGhost} inline-flex h-10 items-center justify-center !px-3`}
                  aria-label="Refresh"
                  title="Refresh"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className={`${masterBtnGhost} inline-flex h-10 items-center justify-center !px-3`}
                    aria-label="Clear filters"
                    title="Clear filters"
                  >
                    <X className="h-4 w-4" />
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

              <label className="block min-w-0 space-y-1">
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

              <label className="block min-w-0 space-y-1">
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

            <div className="flex flex-wrap gap-1.5">
              {(["", "LIVE", "COMPLETED", "READY"] as const).map((status) => (
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
                  style={
                    appliedStatus === status ? { background: "var(--gradient-brand)" } : undefined
                  }
                >
                  {status === "" ? "All" : formatStatus(status)}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className={masterTableHeadClass}>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Candidate</th>
                  <th className="px-3 py-2">Track</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Payment</th>
                  <th className="w-10 px-3 py-2 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground">{row.candidateName}</p>
                      <p className="text-xs text-muted-foreground">{row.candidateEmail}</p>
                    </td>
                    <td className="px-3 py-2 text-foreground">{row.track}</td>
                    <td className="px-3 py-2 text-foreground">{formatStatus(row.status)}</td>
                    <td className="px-3 py-2 text-foreground">{row.durationLabel}</td>
                    <td className="px-3 py-2 text-foreground">{row.score ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                          row.paymentType === "PAID"
                            ? "bg-success/12 text-success ring-success/25"
                            : row.paymentType === "PROMO"
                              ? "bg-indigo-500/15 text-indigo-700 ring-indigo-500/25 dark:text-indigo-300"
                              : "bg-surface/80 text-muted-foreground ring-border"
                        }`}
                      >
                        {formatPayment(row.paymentType)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <MasterRowActionsMenu
                        label={row.candidateName}
                        actions={[
                          {
                            label: "View",
                            icon: Eye,
                            onClick: () => router.push(`/master/practice-sessions/${row.id}`),
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
          <div className="px-3 pb-3">
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
          </div>
        </section>
      </div>
    </MasterShell>
  );
}
