"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useConfirm, useToast } from "@/components/app-feedback";
import {
  PracticeSessionDetailView,
  type PracticeSessionDetail,
} from "@/components/master-practice-session-detail-modal";
import { MasterShell } from "@/components/master-shell";
import { MasterAlert, masterBtnGhost, masterRowActionDangerClass } from "@/components/master-ui";

export default function MasterPracticeSessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [sessionId, setSessionId] = useState("");
  const [session, setSession] = useState<PracticeSessionDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void params.then((value) => setSessionId(value.sessionId));
  }, [params]);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/master/practice-sessions/${sessionId}`, { cache: "no-store" });
      const payload = (await res.json()) as { session?: PracticeSessionDetail; error?: string };
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok || !payload.session) {
        setError(payload.error ?? "Session not found.");
        setSession(null);
        return;
      }
      setSession(payload.session);
    } catch {
      setError("Could not load this session.");
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [router, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteSession() {
    if (!sessionId) return;
    const ok = await confirm({
      title: "Delete this session?",
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;

    setDeleting(true);
    setError("");
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
      router.push("/master/practice-sessions");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <MasterShell
      title={session?.candidateName || "Session"}
      subtitle="Practice interview details."
    >
      <div className="space-y-4">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

        {loading ? (
          <div className="admin-card px-4 py-12 text-center">
            <p className="text-sm font-semibold text-foreground">Loading…</p>
          </div>
        ) : session ? (
          <PracticeSessionDetailView session={session} />
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
          <Link href="/master/practice-sessions" className={`${masterBtnGhost} inline-flex items-center gap-2 !px-3 !py-2`}>
            <ArrowLeft className="h-4 w-4" />
            Back to list
          </Link>
          {session ? (
            <button
              type="button"
              onClick={() => void deleteSession()}
              disabled={deleting}
              className={`${masterRowActionDangerClass} disabled:opacity-50`}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          ) : null}
        </div>
      </div>
    </MasterShell>
  );
}
