"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
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
  masterTableHeadClass,
} from "@/components/master-ui";

type SecurityEvent = {
  id: string;
  email: string;
  success: boolean;
  clientIp: string | null;
  userAgent: string | null;
  trustDevice: boolean;
  createdAt: string;
};

type SecurityResponse = {
  summary: {
    totalEvents: number;
    successfulLogins: number;
    failedLogins: number;
    recentFailed24h: number;
  };
  events: SecurityEvent[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export default function MasterSecurityPage() {
  const router = useRouter();
  const [data, setData] = useState<SecurityResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"" | "success" | "failed">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<MasterPageSize>(MASTER_PAGE_SIZE_OPTIONS[0]);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (filter) params.set("filter", filter);
      const res = await fetch(`/api/master/security?${params.toString()}`);
      const payload = (await res.json()) as SecurityResponse & { error?: string };
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok) {
        setError(payload.error ?? "Unable to load security log.");
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

  return (
    <MasterShell
      title="Security & Login Audit"
      subtitle="Master portal sign-in history — successful logins, failures, IPs, and trusted devices."
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

        <MasterHero
          badge="Login audit"
          title="Login audit trail"
          subtitle="Every master login attempt is recorded with timestamp, IP address, and whether the device was trusted. Review failed attempts to spot brute-force or unauthorized access."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MasterInlineKpi label="Total events" value={data?.summary.totalEvents ?? 0} />
            <MasterInlineKpi label="Successful logins" value={data?.summary.successfulLogins ?? 0} />
            <MasterInlineKpi label="Failed attempts" value={data?.summary.failedLogins ?? 0} />
            <MasterInlineKpi label="Failed (24h)" value={data?.summary.recentFailed24h ?? 0} />
          </div>
        </MasterHero>

        <MasterCard
          elevated
          title="Login events"
          headerAction={
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as typeof filter)}
              className={masterInputClass}
            >
              <option value="">All events</option>
              <option value="success">Successful only</option>
              <option value="failed">Failed only</option>
            </select>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className={masterTableHeadClass}>
                  <th className="py-3 pr-4">Email</th>
                  <th className="pr-4">Result</th>
                  <th className="pr-4">IP</th>
                  <th className="pr-4">Trusted device</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {(data?.events ?? []).map((event) => (
                  <tr key={event.id} className="border-b border-slate-100">
                    <td className="py-4 pr-4 font-semibold text-[#0f172a]">{event.email}</td>
                    <td className="pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          event.success
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70"
                            : "bg-red-50 text-red-700 ring-1 ring-red-200/70"
                        }`}
                      >
                        {event.success ? "Success" : "Failed"}
                      </span>
                    </td>
                    <td className="pr-4 font-mono text-xs text-slate-500">{event.clientIp ?? "—"}</td>
                    <td className="pr-4 text-slate-600">{event.trustDevice ? "Yes" : "No"}</td>
                    <td className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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

          {loading ? <p className="mt-4 text-sm text-slate-500">Loading security log...</p> : null}
        </MasterCard>
      </div>
    </MasterShell>
  );
}
