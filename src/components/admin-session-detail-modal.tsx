"use client";

import {
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Pencil,
  PlayCircle,
  RefreshCw,
  Share2,
  User,
  Briefcase,
  Video,
  ChevronRight,
} from "lucide-react";
import { TranscriptTimeline } from "@/components/transcript-timeline";
import {
  MasterCard,
  MasterInfoCard,
  MasterModal,
  MasterScoreBar,
  MasterStatusBadge,
  masterBtnPrimary,
} from "@/components/master-ui";
import { AppSelect } from "@/components/ui/app-select";
import { describeScoringMode, SCORING_FAIRNESS_NOTE } from "@/lib/scoring-trust";

export type AdminSessionDetail = {
  id: string;
  accessCode: string;
  requirementAccessCode?: string | null;
  candidateInviteCode?: string | null;
  candidateName: string | null;
  candidateEmail: string | null;
  positionTitle: string | null;
  domain: string;
  topic: string;
  status: string;
  durationMin: number;
  interviewDurationDisplay?: string;
  maxOptionalQuestions: number;
  videoFilePath: string | null;
  videoDurationSec: number | null;
  videoUploadedAt: string | null;
  videoRecordingStatus?: "AVAILABLE" | "NOT_UPLOADED";
  scoringJobStatus?: "PENDING" | "SUBMITTED" | "COMPLETED" | "FAILED" | null;
  questions: Array<{
    id?: string;
    prompt: string;
    isMandatory: boolean;
    expectedAnswer?: string | null;
    difficulty?: string | null;
  }>;
  transcript: Array<{
    id: string;
    speaker: string;
    message: string;
    orderIndex: number;
    timestampMs: number | null;
  }>;
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
    accuracyPercent?: number | null;
    questionResults?: Array<{
      questionId: string;
      prompt: string;
      isMandatory: boolean;
      difficulty: string;
      candidateAnswer: string;
      expectedAnswer: string;
      overallScore: number;
      result: "Pass" | "Fail";
      scores: {
        technical_correctness: number;
        completeness: number;
        relevance: number;
        communication_clarity: number;
        problem_solving: number;
      };
      strengths: string[];
      weaknesses: string[];
      missing_concepts: string[];
      detailed_feedback: string;
      interviewer_summary: string;
    }> | null;
  } | null;
  jobDescription?: string | null;
  keySkills?: unknown;
  createdAt?: string;
};

export type ScorecardShareLinkRow = {
  id: string;
  expiresAt: string;
  includeCandidateName: boolean;
};

export type ObserverLinkRow = {
  id: string;
  active: boolean;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

type LastCreatedShare = {
  shareUrl: string;
  pdfUrl: string;
  expiresAt: string;
};

type AdminSessionDetailModalProps = {
  open: boolean;
  loading: boolean;
  session: AdminSessionDetail | null;
  inviteCode: string;
  onClose: () => void;
  onEdit: (sessionId: string) => void;
  regradeBusy: boolean;
  onRunAnswerGrading: (sessionId: string) => void;
  observerLinkBusy: boolean;
  onCreateObserverLink: () => void;
  observerLinkUrl: string;
  observerLinks: ObserverLinkRow[];
  onRevokeObserverLink: (linkId: string) => void;
  onCopy: (text: string, message: string) => void;
  scorecardShareTtlDays: number;
  onScorecardShareTtlDaysChange: (days: number) => void;
  scorecardShareIncludeName: boolean;
  onScorecardShareIncludeNameChange: (value: boolean) => void;
  scorecardShareBusy: boolean;
  onCreateScorecardShareLink: () => void;
  scorecardShareLinks: ScorecardShareLinkRow[];
  lastCreatedShare: LastCreatedShare | null;
  onRevokeScorecardShareLink: (linkId: string) => void;
  holisticFormula: string;
  overallWithAnswerNote: string;
  presentation?: "modal" | "page";
};

function MetaField({
  label,
  value,
  subValue,
}: {
  label: string;
  value: string;
  subValue?: string;
  icon?: typeof User;
}) {
  return (
    <div className="admin-card px-3 py-2">
      <p className="text-muted-foreground text-[11px]">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
      {subValue ? <p className="text-muted-foreground text-xs">{subValue}</p> : null}
    </div>
  );
}

function RecordingBadge({ status }: { status?: "AVAILABLE" | "NOT_UPLOADED" }) {
  const available = status === "AVAILABLE";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
        available
          ? "bg-success/12 text-success ring-success/25"
          : "bg-surface/80 text-muted-foreground ring-border"
      }`}
    >
      {available ? (
        <CheckCircle2 className="h-3 w-3" aria-hidden />
      ) : (
        <Clock className="h-3 w-3" aria-hidden />
      )}
      {available ? "Available" : "Not uploaded"}
    </span>
  );
}

function QuestionResultBadge({ result }: { result: string }) {
  if (result === "Pass") {
    return (
      <span className="rounded-full bg-success/12 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success ring-1 ring-success/25">
        PASS
      </span>
    );
  }
  if (result === "Fail") {
    return (
      <span className="rounded-full bg-destructive/12 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive ring-1 ring-destructive/25">
        FAIL
      </span>
    );
  }
  return (
    <span className="rounded-full bg-surface/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground ring-1 ring-border">
      {result}
    </span>
  );
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AdminSessionDetailModal({
  open,
  loading,
  session,
  inviteCode,
  onClose,
  onEdit,
  regradeBusy,
  onRunAnswerGrading,
  observerLinkBusy,
  onCreateObserverLink,
  observerLinkUrl,
  observerLinks,
  onRevokeObserverLink,
  onCopy,
  scorecardShareTtlDays,
  onScorecardShareTtlDaysChange,
  scorecardShareIncludeName,
  onScorecardShareIncludeNameChange,
  scorecardShareBusy,
  onCreateScorecardShareLink,
  scorecardShareLinks,
  lastCreatedShare,
  onRevokeScorecardShareLink,
  holisticFormula,
  overallWithAnswerNote,
  presentation = "page",
}: AdminSessionDetailModalProps) {
  const candidateLabel = session?.candidateName ?? "—";
  const roleLabel = session?.positionTitle ?? "—";

  return (
    <MasterModal
      open={open}
      onClose={onClose}
      loading={loading}
      size="xl"
      presentation={presentation}
      ariaLabelledBy="admin-session-detail-title"
      title="Session detail"
      subtitle={
        session
          ? `${candidateLabel} · ${roleLabel}${session.createdAt ? ` · ${formatDateTime(session.createdAt)}` : ""}`
          : "Loading session details…"
      }
      badges={
        session ? (
          <>
            <MasterStatusBadge status={session.status} />
            <code className="admin-code-badge admin-code-badge-sm">{inviteCode}</code>
          </>
        ) : null
      }
      headerAction={
        session && !loading ? (
          <button
            type="button"
            onClick={() => onEdit(session.id)}
            className={`${masterBtnPrimary} inline-flex items-center gap-1.5 !px-3 !py-1.5 !text-xs`}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Edit
          </button>
        ) : null
      }
    >
      {loading && !session ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" aria-hidden />
        </div>
      ) : session ? (
        <div className="space-y-3">
          <section className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            <MetaField
              label="Candidate"
              value={candidateLabel}
              subValue={session.candidateEmail ?? undefined}
              icon={User}
            />
            <MetaField label="Role" value={roleLabel} icon={Briefcase} />
            <MetaField
              label="Duration"
              value={
                session.interviewDurationDisplay ?? `${session.durationMin} min (allocated)`
              }
              subValue={`Allocated slot: ${session.durationMin} min`}
              icon={Clock}
            />
            <div className="admin-card px-3 py-2">
              <p className="text-muted-foreground text-[11px]">Recording</p>
              <div className="mt-1">
                <RecordingBadge status={session.videoRecordingStatus} />
                {session.videoUploadedAt ? (
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {formatDateTime(session.videoUploadedAt)}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <MasterCard title="Interview video" elevated>
            {session.videoFilePath ? (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={session.videoFilePath}
                  target="_blank"
                  rel="noreferrer"
                  className="admin-btn-ghost inline-flex items-center gap-1.5 text-xs"
                >
                  <PlayCircle className="h-3.5 w-3.5 text-success" aria-hidden />
                  View recording
                  {session.videoDurationSec ? ` (${session.videoDurationSec}s)` : ""}
                </a>
                <a
                  href={session.videoFilePath}
                  download
                  className="admin-btn-ghost inline-flex items-center gap-1.5 text-xs"
                >
                  <Download className="h-3.5 w-3.5 text-success" aria-hidden />
                  Download
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not available</p>
            )}
          </MasterCard>

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
                {session.scorecard.accuracyPercent != null ? (
                  <MasterScoreBar
                    label="Answer accuracy"
                    value={session.scorecard.accuracyPercent}
                  />
                ) : null}
              </div>

              <div className="mt-5 rounded-xl border border-border bg-surface/40 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Score summary
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                  {session.scorecard.summary}
                </p>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  {describeScoringMode(session.scorecard.scoringMode)}. {SCORING_FAIRNESS_NOTE}
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

              <details className="mt-4 group">
                <summary
                  className="flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-primary transition-colors hover:opacity-90 [&::-webkit-details-marker]:hidden"
                >
                  Scoring formula &amp; metadata
                  <ChevronRight
                    className="h-3.5 w-3.5 transition-transform group-open:rotate-90"
                    aria-hidden
                  />
                </summary>
                <div className="mt-2 space-y-1 rounded-xl border border-border bg-surface/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
                  <p>
                    {holisticFormula}
                    {session.scorecard.accuracyPercent != null ? ` ${overallWithAnswerNote}` : ""}
                  </p>
                  <p>
                    Scoring: {session.scorecard.scoringMode ?? "heuristic"}
                    {session.scorecard.scoringModel ? ` · ${session.scorecard.scoringModel}` : ""}
                  </p>
                  <p>Batch status: {session.scoringJobStatus ?? "not queued"}</p>
                </div>
              </details>

              {(session.scorecard.questionResults?.length ?? 0) === 0 ? (
                <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-4">
                  <p className="text-sm leading-relaxed text-foreground">
                    AI answer review is processing automatically in the background. Refresh this
                    session in a minute, or click Generate answer review if it does not appear.
                  </p>
                  {session.transcript.length > 0 ? (
                    <button
                      type="button"
                      disabled={regradeBusy}
                      onClick={() => onRunAnswerGrading(session.id)}
                      className={`${masterBtnPrimary} mt-3 !px-3 !py-1.5 !text-xs disabled:opacity-50`}
                    >
                      {regradeBusy ? "Grading answers…" : "Generate answer review"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </MasterInfoCard>
          ) : (
            <MasterInfoCard>
              <p className="text-sm font-semibold text-muted-foreground">
                No scorecard yet — interview not completed.
              </p>
            </MasterInfoCard>
          )}

          {session.status === "LIVE" || session.status === "READY" ? (
            <MasterCard
              title="Co-interviewer observer link"
              subtitle="Share a read-only live transcript with hiring managers or panel members."
              elevated
            >
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={observerLinkBusy}
                  onClick={onCreateObserverLink}
                  className={`${masterBtnPrimary} !px-3 !py-1.5 !text-xs disabled:opacity-50`}
                >
                  {observerLinkBusy ? "Creating…" : "Generate observer link"}
                </button>
                {observerLinkUrl ? (
                  <button
                    type="button"
                    onClick={() => onCopy(observerLinkUrl, "Observer link copied.")}
                    className="admin-btn-ghost inline-flex items-center gap-1.5 !px-3 !py-1.5 !text-xs"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    Copy link
                  </button>
                ) : null}
              </div>
              {observerLinkUrl ? (
                <p className="mt-3 break-all text-xs font-mono text-muted-foreground">
                  {observerLinkUrl}
                </p>
              ) : null}
              {observerLinks.length > 0 ? (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Link history
                  </p>
                  <ul className="mt-3 space-y-2">
                    {observerLinks.map((link) => (
                      <li
                        key={link.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface/40 px-3 py-2 text-xs"
                      >
                        <div>
                          <span
                            className={
                              link.active
                                ? "font-semibold text-success"
                                : "font-semibold text-muted-foreground"
                            }
                          >
                            {link.active ? "Active" : link.revokedAt ? "Revoked" : "Expired"}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            · created {new Date(link.createdAt).toLocaleString()} · expires{" "}
                            {new Date(link.expiresAt).toLocaleString()}
                          </span>
                        </div>
                        {link.active ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-destructive hover:opacity-90"
                            onClick={() => onRevokeObserverLink(link.id)}
                          >
                            Revoke
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Observer URLs are shown only when generated. Revoke links you no longer need.
                  </p>
                </div>
              ) : null}
            </MasterCard>
          ) : null}

          {session.scorecard ? (
            <MasterCard
              title="Share scorecard"
              subtitle="Anyone with the link can view this scorecard until it expires. Transcript and recording stay private."
              elevated
              headerAction={<Share2 className="h-4 w-4 text-success" aria-hidden />}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="admin-label mb-0">Expires in</span>
                  <AppSelect
                    value={String(scorecardShareTtlDays)}
                    onValueChange={(value) => onScorecardShareTtlDaysChange(Number(value))}
                    disabled={scorecardShareBusy}
                    aria-label="Share link expiry"
                    options={[
                      { value: "7", label: "7 days" },
                      { value: "14", label: "14 days" },
                      { value: "30", label: "30 days" },
                      { value: "90", label: "90 days" },
                    ]}
                  />
                </label>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-surface/40 px-3 py-2.5 text-sm text-foreground sm:mt-5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                    checked={scorecardShareIncludeName}
                    onChange={(e) => onScorecardShareIncludeNameChange(e.target.checked)}
                    disabled={scorecardShareBusy}
                  />
                  Include candidate name on shared view
                </label>
              </div>
              <button
                type="button"
                className={`${masterBtnPrimary} mt-4 w-full !px-4 !py-2.5 !text-xs disabled:opacity-50`}
                onClick={onCreateScorecardShareLink}
                disabled={scorecardShareBusy}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                {scorecardShareLinks.length > 0 ? "Renew active link" : "Create share link"}
              </button>
              {scorecardShareLinks.length > 0 && !lastCreatedShare ? (
                <p className="mt-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
                  An active link exists but the URL is not stored in this browser. Revoke it to
                  generate a new link, or open the link you saved when you first created it.
                </p>
              ) : null}
              {lastCreatedShare ? (
                <div className="mt-4 rounded-xl border border-primary/25 bg-primary/8 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    Share link
                  </p>
                  <p className="mt-2 break-all text-sm font-medium leading-relaxed text-foreground">
                    {lastCreatedShare.shareUrl}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="admin-btn-ghost inline-flex items-center gap-1.5 text-xs"
                      onClick={() =>
                        onCopy(lastCreatedShare.shareUrl, "Share link copied to clipboard.")
                      }
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      Copy link
                    </button>
                    <a
                      className="admin-btn-ghost inline-flex items-center gap-1.5 text-xs"
                      href={lastCreatedShare.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      Open PDF
                    </a>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Expires {new Date(lastCreatedShare.expiresAt).toLocaleString()}
                  </p>
                </div>
              ) : null}
              {scorecardShareLinks.length > 0 ? (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Active links ({scorecardShareLinks.length})
                  </p>
                  <ul className="mt-3 space-y-2">
                    {scorecardShareLinks.map((link) => (
                      <li
                        key={link.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface/40 px-3 py-2.5 text-sm"
                      >
                        <span className="text-foreground">
                          Expires {new Date(link.expiresAt).toLocaleDateString()}
                          {link.includeCandidateName ? " · includes name" : ""}
                        </span>
                        <button
                          type="button"
                          className="rounded-lg border border-destructive/25 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive transition hover:bg-destructive/15 disabled:opacity-50"
                          onClick={() => onRevokeScorecardShareLink(link.id)}
                          disabled={scorecardShareBusy}
                        >
                          Revoke
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Only one active link per session. Revoke to issue a new URL (previous links stop
                    working).
                  </p>
                </div>
              ) : null}
            </MasterCard>
          ) : null}

          <MasterCard
            title="Question & answer review"
            subtitle="Ideal answers vs what the candidate said"
            elevated
            headerAction={
              (session.scorecard?.questionResults?.length ?? 0) > 0 ? (
                <button
                  type="button"
                  disabled={regradeBusy}
                  onClick={() => onRunAnswerGrading(session.id)}
                  className="admin-btn-ghost inline-flex items-center gap-1.5 !px-3 !py-1.5 !text-xs disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  {regradeBusy ? "Refreshing…" : "Re-run answer grading"}
                </button>
              ) : session.transcript.length > 0 ? (
                <button
                  type="button"
                  disabled={regradeBusy}
                  onClick={() => onRunAnswerGrading(session.id)}
                  className={`${masterBtnPrimary} !px-3 !py-1.5 !text-xs disabled:opacity-50`}
                >
                  {regradeBusy ? "Grading answers…" : "Generate answer review"}
                </button>
              ) : null
            }
          >
            {(session.scorecard?.questionResults?.length ?? 0) > 0 ? (
              <div className="space-y-4">
                {session.scorecard?.questionResults?.map((row, index) => (
                  <article
                    key={row.questionId}
                    className="rounded-xl border border-border bg-surface/30 p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Question {index + 1}
                        {row.isMandatory ? " · Mandatory" : " · Optional"}
                      </p>
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <QuestionResultBadge result={row.result} />
                        {row.result === "Pass" || row.result === "Fail" ? (
                          <span className="font-black text-foreground">{row.overallScore}/10</span>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-foreground">
                      {row.prompt}
                    </p>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-primary/20 bg-primary/8 p-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          Ideal answer (grading reference)
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                          {row.expectedAnswer?.trim() || "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-surface/50 p-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Candidate&apos;s answer (from interview)
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                          {row.candidateAnswer?.trim() || "No clear answer captured in transcript."}
                        </p>
                      </div>
                    </div>

                    {row.detailed_feedback ? (
                      <div className="mt-3 rounded-lg border border-primary/20 bg-primary/8 px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
                        <span className="font-bold text-primary">Grader note: </span>
                        {row.detailed_feedback}
                      </div>
                    ) : null}
                    {(row.missing_concepts?.length ?? 0) > 0 ? (
                      <div className="mt-2 rounded-lg border border-warning/25 bg-warning/10 px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
                        <span className="font-bold text-warning">Missing: </span>
                        {row.missing_concepts.join(", ")}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border bg-surface/40 p-4 text-sm leading-relaxed text-muted-foreground">
                Click &quot;Generate answer review&quot; to compare each question with the ideal
                answer and what the candidate said in the interview.
              </p>
            )}
          </MasterCard>

          <MasterInfoCard title="Full transcript">
            <p className="mb-3 text-xs text-muted-foreground">Interviewer &amp; candidate conversation</p>
            <div className="max-h-96 overflow-y-auto rounded-xl border border-border bg-surface/30 p-4 text-sm">
              <TranscriptTimeline turns={session.transcript} />
            </div>
          </MasterInfoCard>
        </div>
      ) : null}
    </MasterModal>
  );
}
