"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useConfirm, useToast } from "@/components/app-feedback";
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
  masterBtnPrimary,
  masterInputClass,
  masterRowActionClass,
  masterRowActionDangerClass,
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

export default function MasterPaymentsPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "VERIFIED" | "FAILED" | "CREATED">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<MasterPageSize>(MASTER_PAGE_SIZE_OPTIONS[0]);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/master/payments?${params.toString()}`);
      const payload = (await res.json()) as PaymentsResponse & { error?: string };
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok) {
        setError(payload.error ?? "Unable to load payments.");
        return;
      }
      setData(payload);
    } finally {
      setLoading(false);
    }
  }, [router, page, pageSize, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, pageSize]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(""), 3000);
    return () => window.clearTimeout(timer);
  }, [success]);

  async function runPaymentAction(paymentId: string, action: "verify" | "mark_failed" | "refund" | "retry") {
    const labels = {
      verify: "manually verify this payment",
      mark_failed: "mark this payment as failed",
      refund: "refund this payment",
      retry: "reset this payment for retry",
    };
    const ok = await confirm({
      title: "Confirm payment action",
      message: `Are you sure you want to ${labels[action]}? This change will be applied immediately.`,
      confirmLabel: "Yes, continue",
      variant: action === "refund" || action === "mark_failed" ? "danger" : "default",
    });
    if (!ok) return;

    setError("");
    setSuccess("");
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
        setError(payload.error ?? "Unable to update payment.");
        return;
      }
      setSuccess(`Payment ${action.replace("_", " ")} successful.`);
      toast.success(`Payment ${action.replace("_", " ")} successful.`);
      await load();
    } finally {
      setActionId("");
    }
  }

  return (
    <MasterShell
      title="Payments & Revenue"
      subtitle="Razorpay practice payments — verified revenue, failures, and pending checkouts."
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
          badge="Razorpay"
          title="Payments & revenue"
          subtitle="Every practice interview payment flows through Razorpay. Track verified revenue, failed transactions, and pending orders that never completed checkout."
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MasterInlineKpi
              label="Verified revenue"
              value={inrFormatter.format(data?.summary.verifiedRevenue ?? 0)}
            />
            <MasterInlineKpi
              label="Last 30 days"
              value={inrFormatter.format(data?.summary.revenueLast30d ?? 0)}
            />
            <MasterInlineKpi label="Verified payments" value={data?.summary.verifiedCount ?? 0} />
            <MasterInlineKpi label="Failed" value={data?.summary.failedCount ?? 0} />
            <MasterInlineKpi label="Pending" value={data?.summary.pendingCount ?? 0} />
          </div>
        </MasterHero>

        <MasterCard
          elevated
          title="Payment transactions"
          headerAction={
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className={masterInputClass}
            >
              <option value="">All statuses</option>
              <option value="VERIFIED">Verified</option>
              <option value="FAILED">Failed</option>
              <option value="CREATED">Pending</option>
            </select>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className={masterTableHeadClass}>
                  <th className="py-3 pr-4">Candidate</th>
                  <th className="pr-4">Amount</th>
                  <th className="pr-4">Status</th>
                  <th className="pr-4">Domain</th>
                  <th className="pr-4">Order ID</th>
                  <th className="pr-4">Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(data?.payments ?? []).map((payment) => (
                  <tr key={payment.id} className="border-b border-slate-100">
                    <td className="py-4 pr-4">
                      <p className="font-semibold text-[#0f172a]">{payment.candidateName}</p>
                      <p className="text-xs text-slate-500">{payment.candidateEmail}</p>
                    </td>
                    <td className="pr-4 font-semibold">{inrFormatter.format(payment.amount)}</td>
                    <td className="pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[payment.status] ?? "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80"}`}
                      >
                        {payment.status}
                      </span>
                    </td>
                    <td className="pr-4 text-slate-600">{payment.domain}</td>
                    <td className="pr-4 font-mono text-xs text-slate-500">{payment.orderId}</td>
                    <td className="pr-4 text-xs text-slate-500">{new Date(payment.createdAt).toLocaleString()}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {payment.status === "CREATED" ? (
                          <button
                            type="button"
                            disabled={actionId === payment.id}
                            onClick={() => void runPaymentAction(payment.id, "verify")}
                            className={masterRowActionClass}
                          >
                            Verify
                          </button>
                        ) : null}
                        {payment.status === "VERIFIED" ? (
                          <button
                            type="button"
                            disabled={actionId === payment.id}
                            onClick={() => void runPaymentAction(payment.id, "refund")}
                            className={masterRowActionDangerClass}
                          >
                            Refund
                          </button>
                        ) : null}
                        {payment.status === "FAILED" ? (
                          <button
                            type="button"
                            disabled={actionId === payment.id}
                            onClick={() => void runPaymentAction(payment.id, "retry")}
                            className={masterRowActionClass}
                          >
                            Retry
                          </button>
                        ) : null}
                        {payment.status !== "FAILED" && payment.status !== "REFUNDED" ? (
                          <button
                            type="button"
                            disabled={actionId === payment.id}
                            onClick={() => void runPaymentAction(payment.id, "mark_failed")}
                            className={masterRowActionDangerClass}
                          >
                            Fail
                          </button>
                        ) : null}
                      </div>
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
            itemLabel="payments"
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />

          {loading ? <p className="mt-4 text-sm text-slate-500">Loading payments...</p> : null}
        </MasterCard>
      </div>
    </MasterShell>
  );
}
