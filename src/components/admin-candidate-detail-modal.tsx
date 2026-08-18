"use client";

import { Eye, Loader2, Pencil } from "lucide-react";
import {
  MasterModal,
  MasterStatusBadge,
  masterBtnPrimary,
  masterRowActionClass,
} from "@/components/master-ui";

export type AdminCandidateDetail = {
  candidate: {
    candidateId: string;
    name: string;
    email: string | null;
    createdAt: string;
    updatedAt: string;
    sessionsCount: number;
    latestStatus: string;
    latestScore: number | null;
  };
  sessions: Array<{
    id: string;
    accessCode: string;
    status: string;
    createdAt: string;
    positionTitle: string | null;
    domain: string;
    topic: string;
    durationMin: number;
    score: number | null;
  }>;
};

type AdminCandidateDetailModalProps = {
  open: boolean;
  loading: boolean;
  detail: AdminCandidateDetail | null;
  onClose: () => void;
  onEdit: (candidateId: string) => void;
  onViewSession: (sessionId: string) => void;
  onEditSession: (sessionId: string) => void;
  presentation?: "modal" | "page";
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AdminCandidateDetailModal({
  open,
  loading,
  detail,
  onClose,
  onEdit,
  onViewSession,
  presentation = "page",
}: AdminCandidateDetailModalProps) {
  const candidate = detail?.candidate;
  const email = candidate?.email ?? "No email on file";

  return (
    <MasterModal
      open={open}
      onClose={onClose}
      loading={loading}
      size="lg"
      presentation={presentation}
      ariaLabelledBy="admin-candidate-detail-title"
      title="Candidate detail"
      subtitle={
        candidate
          ? `${email} · ${candidate.sessionsCount} session${candidate.sessionsCount === 1 ? "" : "s"}`
          : "Loading candidate details…"
      }
      badges={
        candidate ? (
          <>
            <MasterStatusBadge status={candidate.latestStatus} />
            {candidate.latestScore != null ? (
              <span className="inline-flex items-center rounded-full bg-success/12 px-2.5 py-0.5 text-[10px] font-bold uppercase text-success ring-1 ring-success/25">
                {candidate.latestScore}% match
              </span>
            ) : null}
          </>
        ) : null
      }
      headerAction={
        candidate && !loading ? (
          <button
            type="button"
            onClick={() => onEdit(candidate.candidateId)}
            className={`${masterBtnPrimary} inline-flex items-center gap-1.5 !px-3 !py-1.5 !text-xs`}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Edit
          </button>
        ) : null
      }
    >
      {loading && !detail ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" aria-hidden />
        </div>
      ) : detail ? (
        <div className="space-y-3">
          <section className="admin-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{detail.candidate.name}</p>
                <p className="text-muted-foreground truncate text-xs">{email}</p>
              </div>
              <p className="text-muted-foreground text-xs">
                Added {formatDateTime(detail.candidate.createdAt)}
              </p>
            </div>
          </section>

          <section className="admin-card p-3">
            <h3 className="mb-2 text-sm font-semibold">
              Sessions ({detail.sessions.length})
            </h3>
            {detail.sessions.length ? (
              <ul className="divide-border divide-y">
                {detail.sessions.map((session) => {
                  const roleLabel = session.positionTitle ?? session.domain ?? "Session";
                  return (
                    <li key={session.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{roleLabel}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {session.accessCode} · {new Date(session.createdAt).toLocaleDateString()}
                          {session.score != null ? ` · ${session.score}%` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <MasterStatusBadge status={session.status} />
                        <button
                          type="button"
                          onClick={() => onViewSession(session.id)}
                          className={`${masterRowActionClass} inline-flex items-center gap-1`}
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden />
                          View
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-muted-foreground text-xs">No sessions yet.</p>
            )}
          </section>
        </div>
      ) : null}
    </MasterModal>
  );
}
