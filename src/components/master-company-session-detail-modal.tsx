"use client";

import {
  Building2,
  Calendar,
  Briefcase,
  Clock,
  Loader2,
  Sparkles,
  Target,
  User,
} from "lucide-react";
import { TranscriptTimeline } from "@/components/transcript-timeline";
import {
  MasterInfoCard,
  MasterModal,
  MasterScoreBar,
  MasterStatusBadge,
  masterRowActionDangerClass,
} from "@/components/master-ui";

export type CompanySessionDetail = {
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

type MasterCompanySessionDetailModalProps = {
  open: boolean;
  loading: boolean;
  session: CompanySessionDetail | null;
  onClose: () => void;
  onDelete?: (sessionId: string) => void;
  deleteBusy?: boolean;
};

function MetaField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof User;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-3.5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function MasterCompanySessionDetailModal({
  open,
  loading,
  session,
  onClose,
  onDelete,
  deleteBusy = false,
}: MasterCompanySessionDetailModalProps) {
  const candidateLabel = session?.candidateName ?? "Unknown candidate";
  const emailLabel = session?.candidateEmail ?? "No email on file";
  const companyLabel = session?.companyName ?? "—";
  const roleLabel = session?.positionTitle ?? session?.topic ?? "—";

  return (
    <MasterModal
      open={open}
      onClose={onClose}
      loading={loading}
      size="xl"
      presentation="page"
      title="Company interview detail"
      subtitle={
        session
          ? `${companyLabel} · ${candidateLabel} · ${new Date(session.createdAt).toLocaleString()}`
          : "Loading interview details…"
      }
      badges={
        session ? (
          <>
            <MasterStatusBadge status={session.status} />
            <span className="inline-flex items-center rounded-full bg-primary/12 px-2.5 py-0.5 text-[10px] font-bold uppercase text-primary ring-1 ring-primary/25">
              {session.domain}
            </span>
          </>
        ) : null
      }
      headerAction={
        session && onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(session.id)}
            disabled={deleteBusy}
            className={`${masterRowActionDangerClass} disabled:opacity-50`}
          >
            {deleteBusy ? "Deleting…" : "Delete session"}
          </button>
        ) : null
      }
    >
      {loading && !session ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
          <p className="text-sm font-semibold text-muted-foreground">Loading session details…</p>
        </div>
      ) : session ? (
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetaField label="Candidate" value={candidateLabel} icon={User} />
            <MetaField label="Email" value={emailLabel} />
            <MetaField label="Company" value={companyLabel} icon={Building2} />
            <MetaField label="Role" value={roleLabel} icon={Briefcase} />
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetaField label="Domain" value={session.domain} icon={Target} />
            <MetaField
              label="Duration"
              value={`${session.durationMin} min allocated`}
              icon={Clock}
            />
            <MetaField
              label="Created"
              value={new Date(session.createdAt).toLocaleString()}
              icon={Calendar}
            />
            <MetaField
              label="Scoring pipeline"
              value={session.scoringJobStatus ?? "Not queued"}
              icon={Sparkles}
            />
          </section>

          {session.scorecard ? (
            <MasterInfoCard>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    AI performance score
                  </p>
                  <p className="mt-2 text-4xl font-black tracking-tight text-foreground">
                    {session.scorecard.overallScore}
                    <span className="text-lg font-semibold text-muted-foreground">/100</span>
                  </p>
                </div>
                {(session.scorecard.scoringMode || session.scorecard.scoringModel) && (
                  <div className="rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary ring-1 ring-primary/20">
                    {session.scorecard.scoringMode ?? "heuristic"}
                    {session.scorecard.scoringModel ? ` · ${session.scorecard.scoringModel}` : ""}
                  </div>
                )}
              </div>

              <div className="mt-6 space-y-4">
                <MasterScoreBar label="Communication" value={session.scorecard.communication} />
                <MasterScoreBar label="Domain depth" value={session.scorecard.domainDepth} />
                <MasterScoreBar label="Confidence" value={session.scorecard.confidence} />
              </div>

              <div className="mt-5 rounded-xl border border-border bg-surface/40 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Score summary
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                  {session.scorecard.summary}
                </p>
              </div>

              {(session.scorecard.strengths?.length ?? 0) > 0 ? (
                <div className="mt-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-success">
                    AI strengths
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {session.scorecard.strengths?.map((item) => (
                      <li
                        key={item}
                        className="rounded-lg border border-success/20 bg-success/8 px-3 py-2 text-sm text-foreground"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(session.scorecard.improvements?.length ?? 0) > 0 ? (
                <div className="mt-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-warning">
                    Areas to improve
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {session.scorecard.improvements?.map((item) => (
                      <li
                        key={item}
                        className="rounded-lg border border-warning/25 bg-warning/8 px-3 py-2 text-sm text-foreground"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(session.scorecard.evidence?.length ?? 0) > 0 ? (
                <div className="mt-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Evidence from interview
                  </p>
                  <ul className="mt-2 space-y-2">
                    {session.scorecard.evidence?.map((item) => (
                      <li
                        key={item}
                        className="rounded-xl border border-border bg-surface/50 px-3 py-2.5 text-sm italic text-foreground/85"
                      >
                        &ldquo;{item}&rdquo;
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </MasterInfoCard>
          ) : (
            <MasterInfoCard>
              <p className="text-sm font-semibold text-muted-foreground">
                No scorecard available yet for this session.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Batch status: {session.scoringJobStatus ?? "not queued"}
              </p>
            </MasterInfoCard>
          )}

          <MasterInfoCard title="Interview transcript">
            <div className="max-h-[min(28rem,50vh)] overflow-y-auto rounded-xl border border-border bg-surface/30 p-4">
              <TranscriptTimeline
                turns={session.transcript}
                emptyMessage="No transcript captured for this session."
              />
            </div>
          </MasterInfoCard>
        </div>
      ) : null}
    </MasterModal>
  );
}
