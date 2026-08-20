"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Briefcase, CheckCircle2, Clock, Eye, RefreshCw, Search, X } from "lucide-react";
import { useConfirm, useToast } from "@/components/app-feedback";
import { MasterShell } from "@/components/master-shell";
import {
  MASTER_PAGE_SIZE_OPTIONS,
  MasterPageSize,
  MasterPagination,
} from "@/components/master-pagination";
import { MasterCompanySessionDetailModal } from "@/components/master-company-session-detail-modal";
import {
  MasterAlert,
  MasterKpiCard,
  MasterSelect,
  formatMasterStatus,
  masterBtnGhost,
  masterBtnPrimary,
  masterInputClass,
  MasterRowActionsMenu,
  masterTableHeadClass,
  MasterStatusBadge,
} from "@/components/master-ui";

type CompanySessionsResponse = {
  metrics: { totalSessions: number; activeNow: number; completedCount: number };
  rows: Array<{
    id: string;
    candidateName: string;
    candidateEmail: string;
    companyName: string;
    positionTitle: string;
    domain: string;
    status: string;
    durationLabel: string;
    score: number | null;
    createdAt: string;
  }>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

type SessionDetails = {
  session: {
    id: string;
    candidateName: string | null;
    candidateEmail: string | null;
    companyName: string | null;
    positionTitle: string | null;
    status: string;
    domain: string;
    topic: string;
    durationMin: number;
    createdAt: string;
    scoringJobStatus?: string | null;
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

export default function MasterCompanySessionsPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const searchParams = useSearchParams();
  const [data, setData] = useState<CompanySessionsResponse | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [details, setDetails] = useState<SessionDetails["session"] | null>(null);
  const [detailsLoadingId, setDetailsLoadingId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<MasterPageSize>(MASTER_PAGE_SIZE_OPTIONS[0]);
  const [searchInput, setSearchInput] = useState("");
  const [statusInput, setStatusInput] = useState<"" | "READY" | "LIVE" | "COMPLETED">("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedStatus, setAppliedStatus] = useState<"" | "READY" | "LIVE" | "COMPLETED">("");
  const hasActiveFilters = Boolean(appliedSearch || appliedStatus);

  const load = useCallback(async () => {
    setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (appliedSearch) params.set("search", appliedSearch);
    if (appliedStatus) params.set("status", appliedStatus);
    const res = await fetch(`/api/master/company-sessions?${params.toString()}`);
    const payload = (await res.json()) as CompanySessionsResponse & { error?: string };
    if (res.status === 401) {
      router.push("/master-login");
      return;
    }
    if (!res.ok) {
      setError(payload.error ?? "Unable to load company sessions.");
      return;
    }
    setData(payload);
  }, [router, page, pageSize, appliedSearch, appliedStatus]);

  const viewDetails = useCallback(
    async (sessionId: string) => {
      setDetails(null);
      setDetailsLoadingId(sessionId);
      setError("");
      try {
        const res = await fetch(`/api/master/company-sessions/${sessionId}`);
        const payload = (await res.json()) as SessionDetails & { error?: string };
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
        query ? `/master/company-sessions?${query}` : "/master/company-sessions",
        { scroll: false },
      );
    }
  }, [router, searchParams]);

  useEffect(() => {
    const sessionId = searchParams.get("sessionId");
    if (sessionId) void viewDetails(sessionId);
  }, [searchParams, viewDetails]);

  useEffect(() => {
    const q = searchParams.get("search");
    if (q) {
      setSearchInput(q);
      setAppliedSearch(q);
      setPage(1);
    }
    const status = searchParams.get("status");
    if (status === "LIVE" || status === "READY" || status === "COMPLETED") {
      setStatusInput(status);
      setAppliedStatus(status);
      setPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(""), 3000);
    return () => window.clearTimeout(timer);
  }, [success]);

  async function deleteSession(sessionId: string) {
    const ok = await confirm({
      title: "Delete company session?",
      message: "This permanently removes the interview session and related data. This action cannot be undone.",
      confirmLabel: "Delete session",
      variant: "danger",
    });
    if (!ok) return;
    setError("");
    setSuccess("");
    setDeleteLoadingId(sessionId);
    try {
      const res = await fetch(`/api/master/company-sessions/${sessionId}`, { method: "DELETE" });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(payload.error ?? "Unable to delete session.");
        return;
      }
      if (details?.id === sessionId) {
        closeDetails();
      }
      setSuccess("Company session deleted.");
      toast.success("Company session deleted successfully.");
      await load();
    } finally {
      setDeleteLoadingId(null);
    }
  }

  return (
    <MasterShell title="Company interviews" subtitle="Hiring interviews run by companies.">
      <div className="space-y-3">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}
        {success ? <MasterAlert variant="success">{success}</MasterAlert> : null}

        {details !== null || detailsLoadingId !== null ? (
          <MasterCompanySessionDetailModal
            open
            loading={detailsLoadingId !== null && details === null}
            session={details}
            onClose={closeDetails}
            onDelete={(sessionId) => void deleteSession(sessionId)}
            deleteBusy={details !== null && deleteLoadingId === details.id}
          />
        ) : (
          <>
            <section className="grid gap-2 sm:grid-cols-3">
              <MasterKpiCard
                label="Sessions"
                value={data?.metrics.totalSessions ?? 0}
                icon={Briefcase}
                accent="bg-primary/12 text-primary ring-primary/25"
              />
              <MasterKpiCard
                label="Live now"
                value={data?.metrics.activeNow ?? 0}
                icon={Clock}
                accent="bg-violet/12 text-violet ring-violet/25"
              />
              <MasterKpiCard
                label="Completed"
                value={data?.metrics.completedCount ?? 0}
                icon={CheckCircle2}
                accent="bg-success/12 text-success ring-success/25"
              />
            </section>

            <section className="admin-card overflow-hidden">
              <div className="space-y-3 p-3">
                <div className="grid gap-2 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,12rem)_auto] lg:items-end">
                  <label className="block space-y-1">
                    <span className="admin-label">Search</span>
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setAppliedSearch(searchInput.trim());
                            setAppliedStatus(statusInput);
                            setPage(1);
                          }
                        }}
                        placeholder="Name, company, or role"
                        className={`${masterInputClass} w-full pl-10`}
                      />
                    </div>
                  </label>

                  <label className="block space-y-1">
                    <span className="admin-label">Status</span>
                    <MasterSelect
                      value={statusInput}
                      onValueChange={(value) => setStatusInput(value as typeof statusInput)}
                      className="w-full"
                      aria-label="Filter by status"
                      options={[
                        { value: "", label: "All" },
                        { value: "LIVE", label: "Live" },
                        { value: "READY", label: "Ready" },
                        { value: "COMPLETED", label: "Completed" },
                      ]}
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedSearch(searchInput.trim());
                        setAppliedStatus(statusInput);
                        setPage(1);
                      }}
                      className={`${masterBtnPrimary} inline-flex h-10 items-center gap-2 !px-4`}
                    >
                      <Search className="h-4 w-4" aria-hidden />
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
                        onClick={() => {
                          setSearchInput("");
                          setStatusInput("");
                          setAppliedSearch("");
                          setAppliedStatus("");
                          setPage(1);
                        }}
                        className={`${masterBtnGhost} inline-flex h-10 items-center justify-center !px-3`}
                        aria-label="Clear"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(["", "LIVE", "READY", "COMPLETED"] as const).map((status) => (
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
                      {status === "" ? "All" : formatMasterStatus(status)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead>
                    <tr className={masterTableHeadClass}>
                      <th className="px-3 py-2">Date</th>
                      <th className="pr-3">Candidate</th>
                      <th className="pr-3">Company</th>
                      <th className="pr-3">Role</th>
                      <th className="pr-3">Status</th>
                      <th className="pr-3">Score</th>
                      <th className="w-10 pr-3 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.rows ?? []).map((row) => (
                      <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {new Date(row.createdAt).toLocaleString()}
                        </td>
                        <td className="pr-3">
                          <p className="font-semibold text-foreground">{row.candidateName}</p>
                          <p className="text-xs text-muted-foreground">{row.candidateEmail}</p>
                        </td>
                        <td className="pr-3 font-medium text-foreground">{row.companyName}</td>
                        <td className="pr-3">
                          <p className="font-semibold text-foreground">{row.positionTitle}</p>
                          <p className="text-xs text-muted-foreground">{row.domain}</p>
                        </td>
                        <td className="pr-3">
                          <MasterStatusBadge status={row.status} />
                        </td>
                        <td className="pr-3">
                          {row.score != null ? (
                            <span className="text-sm font-semibold text-foreground">{row.score}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="pr-3 text-right">
                          <MasterRowActionsMenu
                            label={row.candidateName}
                            actions={[
                              {
                                label: detailsLoadingId === row.id ? "Loading…" : "View",
                                icon: Eye,
                                onClick: () => void viewDetails(row.id),
                                disabled: detailsLoadingId === row.id,
                              },
                              {
                                label: deleteLoadingId === row.id ? "Deleting…" : "Delete",
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
            </section>
          </>
        )}
      </div>
    </MasterShell>
  );
}
