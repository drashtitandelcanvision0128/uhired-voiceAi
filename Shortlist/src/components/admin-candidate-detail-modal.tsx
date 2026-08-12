"use client";

import {
  Calendar,
  Clock,
  Loader2,
  Mail,
  Pencil,
  Target,
  User,
  Video,
} from "lucide-react";
import {
  MasterCard,
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
};

function MetaField({
  label,
  value,
  subValue,
  icon: Icon,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon?: typeof User;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-3.5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-foreground">{value}</p>
      {subValue ? <p className="mt-0.5 text-xs text-muted-foreground">{subValue}</p> : null}
    </div>
  );
}

function candidateInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return (name.trim().slice(0, 2) || "?").toUpperCase();
}

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
  onEditSession,
}: AdminCandidateDetailModalProps) {
  const candidate = detail?.candidate;
  const name = candidate?.name ?? "Candidate";
  const email = candidate?.email ?? "No email on file";

  return (
    <MasterModal
      open={open}
      onClose={onClose}
      loading={loading}
      size="lg"
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
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
          <p className="text-sm font-semibold text-muted-foreground">Loading candidate details…</p>
        </div>
      ) : detail ? (
        <div className="space-y-5">
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-primary/8 via-surface/40 to-violet/8 p-4 sm:p-5">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-primary-foreground shadow-[var(--shadow-glow)]"
              style={{ background: "var(--gradient-brand)" }}
            >
              {candidateInitials(detail.candidate.name)}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-extrabold tracking-tight text-foreground">
                {detail.candidate.name}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{email}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {detail.candidate.sessionsCount} linked interview session
                {detail.candidate.sessionsCount === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <section className="grid gap-3 sm:grid-cols-2">
            <MetaField label="Name" value={detail.candidate.name} icon={User} />
            <div className="rounded-xl border border-border bg-surface/40 p-3.5">
              <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                <Target className="h-3 w-3" aria-hidden />
                Latest status
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <MasterStatusBadge status={detail.candidate.latestStatus} />
                {detail.candidate.latestScore != null ? (
                  <span className="text-sm font-black text-success">
                    {detail.candidate.latestScore}% match
                  </span>
                ) : null}
              </div>
            </div>
            <MetaField
              label="Created"
              value={formatDateTime(detail.candidate.createdAt)}
              icon={Calendar}
            />
            <MetaField
              label="Last updated"
              value={formatDateTime(detail.candidate.updatedAt)}
              icon={Clock}
            />
          </section>

          <MasterCard
            title="Sessions"
            subtitle="Latest 50 linked interview sessions"
            elevated
            headerAction={
              <span className="rounded-full bg-surface/80 px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground ring-1 ring-border">
                {detail.sessions.length} shown
              </span>
            }
          >
            {detail.sessions.length ? (
              <div className="space-y-3">
                {detail.sessions.map((session) => {
                  const roleLabel = session.positionTitle ?? session.domain ?? "Session";
                  return (
                    <article
                      key={session.id}
                      className="rounded-xl border border-border bg-surface/30 p-4 transition hover:border-primary/25 hover:bg-surface/50"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-xs font-bold text-primary ring-1 ring-primary/25">
                            <Video className="h-4 w-4" aria-hidden />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-foreground">{roleLabel}</p>
                              <MasterStatusBadge status={session.status} />
                            </div>
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                              {session.accessCode}
                              <span className="mx-1.5 text-border">·</span>
                              {session.durationMin} min
                              <span className="mx-1.5 text-border">·</span>
                              {new Date(session.createdAt).toLocaleDateString()}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Topic: {session.topic}
                              {session.score != null ? (
                                <span className="ml-2 font-black text-success">
                                  {session.score}% match
                                </span>
                              ) : null}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onViewSession(session.id)}
                            className={masterRowActionClass}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditSession(session.id)}
                            className={`${masterBtnPrimary} !px-3 !py-1.5 !text-xs`}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-surface/40 p-5 text-sm text-muted-foreground">
                No sessions linked to this candidate yet.
              </p>
            )}
          </MasterCard>
        </div>
      ) : null}
    </MasterModal>
  );
}
