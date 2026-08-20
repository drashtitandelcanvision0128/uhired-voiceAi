"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Search } from "lucide-react";
import { useConfirm, useToast } from "@/components/app-feedback";
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
  MasterRowActionsMenu,
  masterTableHeadClass,
} from "@/components/master-ui";

type PaymentRow = {
  id: string;
  orderId: string;
  paymentId: string | null;
  amount: number;
  currency: string;
  status: string;
  candidateName: string;
  candidateEmail: string;
  domain: string;
  topic: string;
  durationMin: number;
  promoCode: string | null;
  sessionId: string | null;
  sessionStatus: string | null;
  createdAt: string;
};

type PaymentsResponse = {
  summary: {
    totalPayments: number;
    verifiedCount: number;
    verifiedRevenue: number;
    revenueLast30d: number;
    failedCount: number;
    pendingCount: number;
  };
  payments: PaymentRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

const STATUS_STYLES: Record<string, string> = {
  VERIFIED: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70",
  FAILED: "bg-red-50 text-red-700 ring-1 ring-red-200/70",
  CREATED: "bg-amber-50 text-amber-800 ring-1 ring-amber-200/70",
  REFUNDED: "bg-violet-50 text-violet-700 ring-1 ring-violet-200/70",
};

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatPaymentStatus(status: string) {
  if (status === "CREATED") return "Pending";
  return status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTrack(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\bdevloper\b/gi, "developer")
    .split(" ")
    .map((word) => {
      const core = word.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");
      if (!core) return word;
      const lower = core.toLowerCase();
      const formatted = lower.charAt(0).toUpperCase() + lower.slice(1);
      return word.replace(core, formatted);
    })
    .join(" ");
}

export default function MasterPaymentsPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "VERIFIED" | "FAILED" | "CREATED">("");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<MasterPageSize>(MASTER_PAGE_SIZE_OPTIONS[0]);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (statusFilter) params.set("status", statusFilter);
      if (appliedSearch) params.set("search", appliedSearch);
      const res = await fetch(`/api/master/payments?${params.toString()}`);
      const payload = (await res.json()) as PaymentsResponse & { error?: string };
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok) {
        setError(payload.error ?? "Could not load payments.");
        return;
      }
      setData(payload);
    } finally {
      setLoading(false);
    }
  }, [router, page, pageSize, statusFilter, appliedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, appliedSearch, pageSize]);

  async function runPaymentAction(paymentId: string, action: "verify" | "mark_failed" | "refund" | "retry") {
    const copy = {
      verify: { title: "Verify this payment?", message: "It will be marked as paid." },
      mark_failed: { title: "Mark as failed?", message: "This payment will show as failed." },
      refund: { title: "Refund this payment?", message: "This cannot be undone from here." },
      retry: { title: "Reset for retry?", message: "The candidate can pay again." },
    } as const;
    const ok = await confirm({
      title: copy[action].title,
      message: copy[action].message,
      confirmLabel: action === "refund" ? "Refund" : "Continue",
      variant: action === "refund" || action === "mark_failed" ? "danger" : "default",
    });
    if (!ok) return;

    setError("");
    setActionId(paymentId);
    try {
      const res = await fetch(`/api/master/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await res.json()) as { error?: string };
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok) {
        setError(payload.error ?? "Could not update payment.");
        return;
      }
      toast.success("Payment updated.");
      await load();
    } finally {
      setActionId("");
    }
  }

  return (
    <MasterShell title="Payments" subtitle="Practice interview payments.">
      <div className="space-y-3">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

        <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <article className="admin-card p-3">
            <p className="text-xs text-muted-foreground">Revenue</p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {inrFormatter.format(data?.summary.verifiedRevenue ?? 0)}
            </p>
          </article>
          <article className="admin-card p-3">
            <p className="text-xs text-muted-foreground">Last 30 days</p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {inrFormatter.format(data?.summary.revenueLast30d ?? 0)}
            </p>
          </article>
          <article className="admin-card p-3">
            <p className="text-xs text-muted-foreground">Verified</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{data?.summary.verifiedCount ?? 0}</p>
          </article>
          <article className="admin-card p-3">
            <p className="text-xs text-muted-foreground">Failed</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{data?.summary.failedCount ?? 0}</p>
          </article>
          <article className="admin-card p-3">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{data?.summary.pendingCount ?? 0}</p>
          </article>
        </section>

        <section className="admin-card overflow-hidden">
          <div className="flex flex-wrap items-end gap-2 p-3">
            <div className="relative min-w-[14rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") setAppliedSearch(searchInput.trim());
                }}
                placeholder="Name, email, or order"
                className={`${masterInputClass} w-full pl-10`}
                aria-label="Search payments"
              />
            </div>
            <MasterSelect
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
              className="min-w-[10rem]"
              aria-label="Filter by status"
              options={[
                { value: "", label: "All statuses" },
                { value: "VERIFIED", label: "Verified" },
                { value: "FAILED", label: "Failed" },
                { value: "CREATED", label: "Pending" },
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
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className={masterTableHeadClass}>
                  <th className="py-2 pr-4">Candidate</th>
                  <th className="pr-4">Amount</th>
                  <th className="pr-4">Status</th>
                  <th className="pr-4">Track</th>
                  <th className="pr-4">Order</th>
                  <th className="pr-4">Date</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.payments ?? []).map((payment) => (
                  <tr key={payment.id} className="border-b border-border">
                    <td className="py-2.5 pr-4">
                      <p className="font-semibold text-foreground">{payment.candidateName}</p>
                      <p className="text-xs text-muted-foreground">{payment.candidateEmail}</p>
                    </td>
                    <td className="pr-4 font-semibold text-foreground">
                      {inrFormatter.format(payment.amount)}
                    </td>
                    <td className="pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[payment.status] ?? "bg-surface text-muted-foreground ring-1 ring-border"}`}
                      >
                        {formatPaymentStatus(payment.status)}
                      </span>
                    </td>
                    <td className="pr-4 text-muted-foreground">{formatTrack(payment.domain)}</td>
                    <td className="pr-4 font-mono text-xs text-muted-foreground">{payment.orderId}</td>
                    <td className="pr-4 text-xs text-muted-foreground">
                      {new Date(payment.createdAt).toLocaleString()}
                    </td>
                    <td className="text-right">
                      <MasterRowActionsMenu
                        label={payment.candidateName}
                        actions={[
                          payment.status === "CREATED"
                            ? {
                                label: "Verify",
                                onClick: () => void runPaymentAction(payment.id, "verify"),
                                disabled: actionId === payment.id,
                              }
                            : null,
                          payment.status === "VERIFIED"
                            ? {
                                label: "Refund",
                                onClick: () => void runPaymentAction(payment.id, "refund"),
                                danger: true,
                                disabled: actionId === payment.id,
                              }
                            : null,
                          payment.status === "FAILED"
                            ? {
                                label: "Retry",
                                onClick: () => void runPaymentAction(payment.id, "retry"),
                                disabled: actionId === payment.id,
                              }
                            : null,
                          payment.status !== "FAILED" && payment.status !== "REFUNDED"
                            ? {
                                label: "Fail",
                                onClick: () => void runPaymentAction(payment.id, "mark_failed"),
                                danger: true,
                                disabled: actionId === payment.id,
                              }
                            : null,
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !(data?.payments.length ?? 0) ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No payments found.</p>
            ) : null}
            {loading && !(data?.payments.length ?? 0) ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            ) : null}
          </div>

          <MasterPagination
            page={page}
            pageSize={pageSize}
            totalItems={data?.pagination.total ?? 0}
            itemLabel="payments"
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
