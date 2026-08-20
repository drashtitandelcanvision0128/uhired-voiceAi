"use client";

import {
  Calendar,
  Clock,
  Sparkles,
  Target,
  User,
} from "lucide-react";
import { TranscriptTimeline } from "@/components/transcript-timeline";
import {
  MasterInfoCard,
  MasterScoreBar,
  MasterStatusBadge,
} from "@/components/master-ui";

export type PracticeSessionDetail = {
  id: string;
  candidateName: string | null;
  candidateEmail: string | null;
  status: string;
  domain: string;
  topic: string;
  durationMin: number;
  createdAt: string;
  scoringJobStatus?: "PENDING" | "SUBMITTED" | "COMPLETED" | "FAILED" | null;
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

function MetaField({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof User }) {
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

export function PracticeSessionDetailView({ session }: { session: PracticeSessionDetail }) {
  const candidateLabel = session.candidateName ?? "Unknown candidate";
  const emailLabel = session.candidateEmail ?? "No email on file";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <MasterStatusBadge status={session.status} />
        <span className="inline-flex items-center rounded-full bg-primary/12 px-2.5 py-0.5 text-[10px] font-bold uppercase text-primary ring-1 ring-primary/25">
          {session.domain}
        </span>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetaField label="Candidate" value={candidateLabel} icon={User} />
        <MetaField label="Email" value={emailLabel} />
        <MetaField label="Topic" value={session.topic || "—"} icon={Target} />
        <MetaField label="Duration" value={`${session.durationMin} min`} icon={Clock} />
        <MetaField label="Created" value={new Date(session.createdAt).toLocaleString("en-IN")} icon={Calendar} />
        <MetaField label="Scoring" value={session.scoringJobStatus ?? "Not queued"} icon={Sparkles} />
      </section>

      {session.scorecard ? (
        <MasterInfoCard>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Score</p>
              <p className="mt-2 text-4xl font-black tracking-tight text-foreground">
                {session.scorecard.overallScore}
                <span className="text-lg font-semibold text-muted-foreground">/100</span>
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <MasterScoreBar label="Communication" value={session.scorecard.communication} />
            <MasterScoreBar label="Domain depth" value={session.scorecard.domainDepth} />
            <MasterScoreBar label="Confidence" value={session.scorecard.confidence} />
          </div>

          <div className="mt-5 rounded-xl border border-border bg-surface/40 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Summary</p>
            <p className="mt-2 text-sm leading-relaxed text-foreground/90">{session.scorecard.summary}</p>
          </div>

          {(session.scorecard.strengths?.length ?? 0) > 0 ? (
            <div className="mt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-success">Strengths</p>
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
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-warning">To improve</p>
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
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Evidence</p>
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
          <p className="text-sm font-semibold text-muted-foreground">No scorecard yet.</p>
        </MasterInfoCard>
      )}

      <MasterInfoCard title="Transcript">
        <div className="max-h-[min(32rem,60vh)] overflow-y-auto rounded-xl border border-border bg-surface/30 p-4">
          <TranscriptTimeline
            turns={session.transcript}
            emptyMessage="No transcript for this session."
            className="text-foreground"
          />
        </div>
      </MasterInfoCard>
    </div>
  );
}
