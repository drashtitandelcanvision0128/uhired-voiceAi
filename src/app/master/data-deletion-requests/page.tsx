"use client";

import { useCallback, useEffect, useState } from "react";
import { MasterShell } from "@/components/master-shell";
import { MasterAlert, masterBtnGhost, masterBtnPrimary } from "@/components/master-ui";
import { useAppFeedback } from "@/components/app-feedback";

type DeletionRequest = {
  id: string;
  email: string;
  reason: string | null;
  status: string;
  resultNote: string | null;
  createdAt: string;
  processedAt: string | null;
};

export default function MasterDataDeletionRequestsPage() {
  const { confirmAction, notify } = useAppFeedback();
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/master/data-deletion-requests?status=PENDING");
      const payload = (await res.json()) as { requests?: DeletionRequest[]; error?: string };
      if (!res.ok) {
        setError(payload.error ?? "Unable to load requests.");
        return;
      }
      setRequests(payload.requests ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(requestId: string, action: "process" | "reject") {
    const ok = await confirmAction({
      title: action === "process" ? "Process deletion?" : "Reject request?",
      message:
        action === "process"
          ? "This anonymizes remaining company interview data for this email."
          : "The request will be marked rejected without further data changes.",
      confirmLabel: action === "process" ? "Process" : "Reject",
      variant: action === "process" ? "danger" : "default",
    });
    if (!ok) return;

    setBusyId(requestId);
    try {
      const res = await fetch(`/api/master/data-deletion-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        setError(payload.error ?? "Action failed.");
        return;
      }
      notify.success(action === "process" ? "Deletion processed." : "Request rejected.");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <MasterShell
      title="Data deletion requests"
      subtitle="Candidate privacy requests that need master follow-up for company interview data."
    >
      {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={() => void load()} className={masterBtnGhost}>
          Refresh
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending deletion requests.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((row) => (
            <div key={row.id} className="rounded-xl border border-border bg-surface/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{row.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString("en-IN")} · {row.status}
                  </p>
                  {row.reason ? (
                    <p className="mt-2 text-sm text-foreground/90">Reason: {row.reason}</p>
                  ) : null}
                  {row.resultNote ? (
                    <p className="mt-1 text-xs text-muted-foreground">{row.resultNote}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void act(row.id, "process")}
                    className={`${masterBtnPrimary} disabled:opacity-50`}
                  >
                    Process
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void act(row.id, "reject")}
                    className={`${masterBtnGhost} disabled:opacity-50`}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </MasterShell>
  );
}
