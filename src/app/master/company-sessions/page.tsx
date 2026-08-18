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
  MasterCard,
  MasterHero,
  MasterKpiCard,
  MasterSelect,
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
    <MasterShell
      title="Company Interviews"
      subtitle="Monitor and manage hiring interviews across all companies on the platform."
      topActions={
        <button type="button" onClick={() => void load()} className={`${masterBtnGhost} inline-flex items-center gap-2 !px-4 !py-2.5`}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      }
    >
      <div className="space-y-5">
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
        <MasterHero
          badge="HIRING SESSIONS"
          title="Company interview monitoring"
          subtitle="Track candidate interviews created by company admins — view transcripts, scores, and session status."
        />

        <section className="grid gap-3 sm:grid-cols-3">
          <MasterKpiCard
            label="Total Sessions"
            value={data?.metrics.totalSessions ?? 0}
            icon={Briefcase}
            accent="bg-primary/12 text-primary ring-primary/25"
          />
          <MasterKpiCard
            label="Live Now"
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

        <MasterCard
          elevated
          title="Company interview sessions"
          subtitle="Search by candidate, company, role, or domain. Filter by session status."
        >
          <div className="mb-5 rounded-xl border border-border bg-surface/40 p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] lg:items-end">
              <label className="block space-y-1.5">
                <span className="admin-label">Search sessions</span>
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
                        setPage(1);
                      }
                    }}
                    placeholder="Candidate, company, role, domain..."
                    className={`${masterInputClass} w-full pl-10`}
                  />
                </div>
              </label>

              <label className="block space-y-1.5">
                <span className="admin-label">Status</span>
                <MasterSelect
                  value={statusInput}
                  onValueChange={(value) => setStatusInput(value as typeof statusInput)}
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

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAppliedSearch(searchInput.trim());
                    setAppliedStatus(statusInput);
                    setPage(1);
                  }}
                  className={`${masterBtnPrimary} inline-flex items-center gap-2 !px-5`}
                >
                  <Search className="h-4 w-4" aria-hidden />
                  Search
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
                    className={`${masterBtnGhost} inline-flex items-center gap-1.5 !px-4`}
                  >
                    <X className="h-4 w-4" aria-hidden />
                    Clear
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(["", "LIVE", "READY", "COMPLETED"] as const).map((status) => (
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
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className={masterTableHeadClass}>
                  <th className="py-2 pr-3">Date</th>
                  <th className="pr-3">Candidate</th>
                  <th className="pr-3">Company</th>
                  <th className="pr-3">Role / Track</th>
                  <th className="pr-3">Status</th>
                  <th className="pr-3">Score</th>
                  <th className="w-10 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border transition-colors hover:bg-surface/40"
                  >
                    <td className="py-3.5 pr-3 text-xs text-muted-foreground">
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
                        <span className="text-sm font-bold text-foreground">{row.score}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
