"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/app-feedback";
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
  MasterInlineKpi,
  masterBtnGhost,
  masterInputClass,
  masterRowActionClass,
  masterTableHeadClass,
} from "@/components/master-ui";

type DeletionRequest = {
  id: string;
  email: string;
  reason: string | null;
  status: "PENDING" | "PROCESSED" | "REJECTED";
  clientIp: string | null;
  processedAt: string | null;
  resultNote: string | null;
  createdAt: string;
};

type ListResponse = {
  requests: DeletionRequest[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export default function MasterDataDeletionPage() {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"" | "PENDING" | "PROCESSED" | "REJECTED">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<MasterPageSize>(MASTER_PAGE_SIZE_OPTIONS[0]);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (filter) params.set("status", filter);
      const res = await fetch(`/api/master/data-deletion-requests?${params.toString()}`);
      const payload = (await res.json()) as ListResponse & { error?: string };
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok) {
        setError(payload.error ?? "Unable to load deletion requests.");
        return;
      }
      setData(payload);
    } finally {
      setLoading(false);
    }
  }, [router, page, pageSize, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filter, pageSize]);

  async function updateStatus(requestId: string, status: "PROCESSED" | "REJECTED") {
    setError("");
    setSuccess("");
    const res = await fetch(`/api/master/data-deletion-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        resultNote:
          status === "PROCESSED"
            ? "Marked processed by master admin."
            : "Rejected — company data retained per employer policy.",
      }),
    });
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    if (res.status === 401) {
      router.push("/master-login");
      return;
    }
    if (!res.ok) {
      setError(payload?.error ?? "Unable to update request.");
      return;
    }
    setSuccess(`Request ${status.toLowerCase()}.`);
    toast.success(`Request ${status.toLowerCase()} successfully.`);
    await load();
  }

  const pendingCount = data?.requests.filter((r) => r.status === "PENDING").length ?? 0;

  return (
    <MasterShell
      title="Data Deletion Requests"
      subtitle="Candidate privacy requests — practice data auto-purged; company sessions need review."
      topActions={
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={`${masterBtnGhost} inline-flex items-center gap-2 !px-4 !py-2.5 disabled:opacity-60`}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      }
    >
      <div className="space-y-5">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}
        {success ? <MasterAlert variant="success">{success}</MasterAlert> : null}

        <MasterHero
          badge="Privacy"
          title="Deletion request queue"
          subtitle="Practice sessions are purged automatically when candidates submit the privacy form. PENDING items usually involve company interview data held by employers."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MasterInlineKpi label="On this page" value={data?.requests.length ?? 0} />
            <MasterInlineKpi label="Pending (page)" value={pendingCount} />
            <MasterInlineKpi label="Total" value={data?.pagination.total ?? 0} />
          </div>
        </MasterHero>

        <MasterCard
          elevated
          title="Requests"
          headerAction={
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as typeof filter)}
              className={masterInputClass}
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSED">Processed</option>
              <option value="REJECTED">Rejected</option>
            </select>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className={masterTableHeadClass}>
                  <th className="py-3 pr-4">Email</th>
                  <th className="pr-4">Status</th>
                  <th className="pr-4">Reason</th>
                  <th className="pr-4">Note</th>
                  <th className="pr-4">Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.requests ?? []).map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-4 pr-4 font-semibold text-[#0f172a]">{row.email}</td>
                    <td className="pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          row.status === "PROCESSED"
                            ? "bg-emerald-50 text-emerald-700"
                            : row.status === "PENDING"
                              ? "bg-amber-50 text-amber-800"
                              : "bg-red-50 text-red-700"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="pr-4 max-w-[200px] truncate text-slate-600">{row.reason ?? "—"}</td>
                    <td className="pr-4 max-w-[240px] truncate text-xs text-slate-500">
                      {row.resultNote ?? "—"}
                    </td>
                    <td className="pr-4 text-xs text-slate-500">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="space-x-2">
                      {row.status === "PENDING" ? (
                        <>
                          <button
                            type="button"
                            className={masterRowActionClass}
                            onClick={() => void updateStatus(row.id, "PROCESSED")}
                          >
                            Mark processed
                          </button>
                          <button
                            type="button"
                            className={masterRowActionClass}
                            onClick={() => void updateStatus(row.id, "REJECTED")}
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
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
            itemLabel="requests"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />

          {loading ? <p className="mt-4 text-sm text-slate-500">Loading requests…</p> : null}
          {!loading && (data?.requests.length ?? 0) === 0 ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <ShieldAlert className="h-4 w-4" />
              No deletion requests match this filter.
            </p>
          ) : null}
        </MasterCard>
      </div>
    </MasterShell>
  );
}
