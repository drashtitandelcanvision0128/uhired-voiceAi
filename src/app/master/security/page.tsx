"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Search } from "lucide-react";
import { MasterShell } from "@/components/master-shell";
import {
  MASTER_PAGE_SIZE_OPTIONS,
  MasterPageSize,
  MasterPagination,
} from "@/components/master-pagination";
import {
  MasterAlert,
  MasterSelect,
  masterBtnGhost,
  masterBtnPrimary,
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

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatIp(ip: string | null) {
  if (!ip) return "—";
  if (ip === "::1" || ip === "127.0.0.1") return "Local";
  return ip;
}

export default function MasterSecurityPage() {
  const router = useRouter();
  const [data, setData] = useState<SecurityResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"" | "success" | "failed">("");
  const [trustFilter, setTrustFilter] = useState<"" | "yes" | "no">("");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<MasterPageSize>(MASTER_PAGE_SIZE_OPTIONS[0]);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (filter) params.set("filter", filter);
      if (trustFilter) params.set("trust", trustFilter);
      if (appliedSearch) params.set("search", appliedSearch);
      const res = await fetch(`/api/master/security?${params.toString()}`);
      const payload = (await res.json()) as SecurityResponse & { error?: string };
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok) {
        setError(payload.error ?? "Could not load logins.");
        return;
      }
      setData(payload);
    } finally {
      setLoading(false);
    }
  }, [router, page, pageSize, filter, trustFilter, appliedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filter, trustFilter, appliedSearch, pageSize]);

  return (
    <MasterShell title="Security" subtitle="Who tried to sign in as admin.">
      <div className="space-y-3">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <article className="admin-card p-3">
            <p className="text-xs text-muted-foreground">Logins</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{data?.summary.totalEvents ?? 0}</p>
          </article>
          <article className="admin-card p-3">
            <p className="text-xs text-muted-foreground">Success</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{data?.summary.successfulLogins ?? 0}</p>
          </article>
          <article className="admin-card p-3">
            <p className="text-xs text-muted-foreground">Failed</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{data?.summary.failedLogins ?? 0}</p>
          </article>
          <article className="admin-card p-3">
            <p className="text-xs text-muted-foreground">Failed (24h)</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{data?.summary.recentFailed24h ?? 0}</p>
          </article>
        </section>

        <section className="admin-card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 p-3">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") setAppliedSearch(searchInput.trim());
                }}
                placeholder="Email or IP"
                className={`${masterInputClass} w-full pl-10`}
                aria-label="Search login events"
              />
            </div>
            <MasterSelect
              value={filter}
              onValueChange={(value) => setFilter(value as typeof filter)}
              className="min-w-[9rem]"
              aria-label="Filter by result"
              options={[
                { value: "", label: "All" },
                { value: "success", label: "Success" },
                { value: "failed", label: "Failed" },
              ]}
            />
            <MasterSelect
              value={trustFilter}
              onValueChange={(value) => setTrustFilter(value as typeof trustFilter)}
              className="min-w-[9rem]"
              aria-label="Filter by trusted device"
              options={[
                { value: "", label: "All devices" },
                { value: "yes", label: "Trusted" },
                { value: "no", label: "Not trusted" },
              ]}
            />
            <button
              type="button"
              onClick={() => setAppliedSearch(searchInput.trim())}
              className={`${masterBtnPrimary} !px-4`}
            >
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
          </div>

          <div className="overflow-x-auto px-3 pb-3">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className={masterTableHeadClass}>
                  <th className="py-2 pr-4">Email</th>
                  <th className="pr-4">Result</th>
                  <th className="pr-4">IP</th>
                  <th className="pr-4">Trusted</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {(data?.events ?? []).map((event) => (
                  <tr key={event.id} className="border-b border-border">
                    <td className="py-2.5 pr-4 font-semibold text-foreground">{event.email}</td>
                    <td className="pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          event.success
                            ? "bg-success/12 text-success ring-1 ring-success/25"
                            : "bg-destructive/12 text-destructive ring-1 ring-destructive/25"
                        }`}
                      >
                        {event.success ? "Success" : "Failed"}
                      </span>
                    </td>
                    <td className="pr-4 font-mono text-xs text-muted-foreground">{formatIp(event.clientIp)}</td>
                    <td className="pr-4 text-muted-foreground">{event.trustDevice ? "Yes" : "No"}</td>
                    <td className="text-xs text-muted-foreground">{formatWhen(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !(data?.events.length ?? 0) ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No login events.</p>
            ) : null}
            {loading && !(data?.events.length ?? 0) ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : null}
          </div>

          <MasterPagination
            page={page}
            pageSize={pageSize}
            totalItems={data?.pagination.total ?? 0}
            itemLabel="logins"
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
