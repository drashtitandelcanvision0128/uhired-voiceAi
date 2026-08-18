"use client";

import { CalendarClock, Eye, Link2, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  MasterModal,
  MasterStatusBadge,
  masterRowActionClass,
} from "@/components/master-ui";
import { getAdminInviteStatus, type AdminInviteStatus } from "@/lib/admin-invite-status";

export type AdminRequirementInvite = {
  id?: string;
  email: string;
  candidateName?: string | null;
  source?: string | null;
  accessCode: string;
  scheduledAt?: string | null;
  emailSentAt: string | null;
  usedAt: string | null;
  expiresAt: string | null;
};

export type AdminRequirementDetail = {
  requirementId: string;
  title: string | null;
  domain: string;
  topic: string;
  durationMin: number;
  jobDescription: string | null;
  keySkills: unknown;
  maxOptionalQuestions: number;
  mandatoryQuestions: string[];
  mandatoryIdealAnswers?: string;
  optionalQuestions: string[];
  optionalIdealAnswers?: string;
  sessionsCount: number;
  requirementAccessCode: string | null;
  candidateInvites: AdminRequirementInvite[];
  createdAt: string;
  linkedInterviews: Array<{
    sessionId: string;
    candidateName: string | null;
    candidateEmail: string | null;
    status: string;
    overallScore: number | null;
    interviewDurationDisplay: string;
    createdAt: string;
  }>;
};

type AdminRequirementDetailModalProps = {
  open: boolean;
  requirement: AdminRequirementDetail | null;
  onClose: () => void;
  onOpenSession: (sessionId: string) => void;
  onCopyShareLink?: (requirement: AdminRequirementDetail) => void;
  onScheduleInvite?: (input: {
    requirementId: string;
    email: string;
    scheduledAt: string;
  }) => Promise<void>;
  scheduleBusyEmail?: string | null;
  presentation?: "modal" | "page";
};

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function formatInterviewTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  const date = Number.isNaN(d.getTime()) ? new Date() : new Date(d);
  if (!iso || Number.isNaN(d.getTime())) {
    date.setMinutes(0, 0, 0);
    date.setHours(date.getHours() + 1);
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function inviteStatusChipClass(status: AdminInviteStatus): string {
  switch (status) {
    case "Used":
      return "bg-success/12 text-success ring-success/25";
    case "Scheduled":
    case "Sent":
      return "bg-primary/12 text-primary ring-primary/25";
    case "Applied":
    case "Expired":
      return "bg-warning/12 text-warning ring-warning/25";
    default:
      return "bg-surface/80 text-muted-foreground ring-border";
  }
}

function inviteStatusDotClass(status: AdminInviteStatus): string {
  switch (status) {
    case "Used":
      return "bg-success";
    case "Scheduled":
    case "Sent":
      return "bg-primary";
    case "Applied":
    case "Expired":
      return "bg-warning";
    default:
      return "bg-muted-foreground";
  }
}

function parseKeySkills(keySkills: unknown): string[] {
  if (!Array.isArray(keySkills)) return [];
  return keySkills.map((s) => String(s).trim()).filter(Boolean);
}

function InviteScheduleRow({
  invite,
  requirementId,
  onScheduleInvite,
  busy,
}: {
  invite: AdminRequirementInvite;
  requirementId: string;
  onScheduleInvite?: AdminRequirementDetailModalProps["onScheduleInvite"];
  busy: boolean;
}) {
  const [scheduledAt, setScheduledAt] = useState(() => toDatetimeLocalValue(invite.scheduledAt));
  const status = getAdminInviteStatus(invite);
  const canSchedule = Boolean(onScheduleInvite) && status !== "Used";

  return (
    <tr>
      <td className="max-w-[220px] py-2 pr-3">
        <p className="truncate font-medium">{invite.candidateName?.trim() || "—"}</p>
        <p className="text-muted-foreground truncate text-xs">{invite.email}</p>
      </td>
      <td className="py-2 pr-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${inviteStatusChipClass(status)}`}
        >
          <span className={`size-1.5 rounded-full ${inviteStatusDotClass(status)}`} />
          {status}
        </span>
      </td>
      <td className="text-muted-foreground py-2 pr-3 text-xs">
        {formatInterviewTime(invite.scheduledAt)}
      </td>
      <td className="text-muted-foreground py-2 pr-3 text-xs">{formatDateShort(invite.usedAt)}</td>
      <td className="py-2">
        {canSchedule ? (
          <form
            className="flex min-w-[240px] items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              void onScheduleInvite?.({
                requirementId,
                email: invite.email,
                scheduledAt,
              });
            }}
          >
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              className="border-input bg-background h-8 w-[11.5rem] rounded-md border px-2 text-xs"
              required
            />
            <button
              type="submit"
              disabled={busy || !scheduledAt}
              className="admin-btn-primary inline-flex h-8 items-center gap-1 px-2 text-[11px] disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-3 animate-spin" /> : <CalendarClock className="size-3" />}
              {invite.scheduledAt ? "Resend" : "Schedule"}
            </button>
          </form>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </td>
    </tr>
  );
}

export function AdminRequirementDetailModal({
  open,
  requirement,
  onClose,
  onOpenSession,
  onCopyShareLink,
  onScheduleInvite,
  scheduleBusyEmail,
  presentation = "page",
}: AdminRequirementDetailModalProps) {
  if (!requirement) {
    return (
      <MasterModal
        open={open}
        onClose={onClose}
        presentation={presentation}
        title="Opening view"
        subtitle="Loading…"
      >
        {null}
      </MasterModal>
    );
  }

  const roleLabel = requirement.title ?? requirement.domain;
  const skills = parseKeySkills(requirement.keySkills);
  const inviteCount = requirement.candidateInvites?.length ?? 0;

  return (
    <MasterModal
      open={open}
      onClose={onClose}
      size="xl"
      presentation={presentation}
      ariaLabelledBy="admin-requirement-detail-title"
      title="Opening view"
      subtitle={`${roleLabel} · ${requirement.durationMin} min · ${inviteCount} candidate${inviteCount === 1 ? "" : "s"}`}
    >
      <div className="space-y-3">
        {onCopyShareLink ? (
          <section className="admin-card flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Share apply link</h3>
              <p className="text-muted-foreground text-xs">
                Copy this link and send it on WhatsApp, LinkedIn, or email. Candidate fills name + email.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onCopyShareLink(requirement)}
              className="admin-btn-primary inline-flex h-9 shrink-0 items-center gap-1.5 px-3 text-xs"
            >
              <Link2 className="size-3.5" />
              Copy share link
            </button>
          </section>
        ) : null}
        <section className="admin-card p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Candidates</h3>
            <span className="text-muted-foreground text-xs tabular-nums">
              {inviteCount} on this opening
            </span>
          </div>
          {inviteCount ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-[11px]">
                    <th className="py-1.5 pr-3 font-medium">Candidate</th>
                    <th className="py-1.5 pr-3 font-medium">Status</th>
                    <th className="py-1.5 pr-3 font-medium">Interview time</th>
                    <th className="py-1.5 pr-3 font-medium">Used</th>
                    <th className="py-1.5 font-medium">Schedule</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {requirement.candidateInvites.map((invite) => (
                    <InviteScheduleRow
                      key={`${invite.email}-${invite.scheduledAt ?? "none"}-${invite.emailSentAt ?? "none"}`}
                      invite={invite}
                      requirementId={requirement.requirementId}
                      onScheduleInvite={onScheduleInvite}
                      busy={scheduleBusyEmail === invite.email}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              No candidates yet. Share the apply link — they will appear here so you can schedule their
              interview.
            </p>
          )}
        </section>

        {requirement.jobDescription?.trim() || skills.length > 0 ? (
          <section className="admin-card space-y-2 p-3">
            {requirement.jobDescription?.trim() ? (
              <div>
                <h3 className="mb-1 text-sm font-semibold">Job description</h3>
                <p className="text-sm whitespace-pre-wrap">{requirement.jobDescription.trim()}</p>
              </div>
            ) : null}
            {skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <span key={skill} className="bg-muted rounded-md px-2 py-0.5 text-xs">
                    {skill}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {requirement.mandatoryQuestions.length > 0 ? (
          <section className="admin-card p-3">
            <h3 className="mb-2 text-sm font-semibold">
              Questions ({requirement.mandatoryQuestions.length})
            </h3>
            <ol className="space-y-1.5 text-sm">
              {requirement.mandatoryQuestions.map((question, index) => (
                <li key={`${requirement.requirementId}-m-${index}`} className="flex gap-2">
                  <span className="text-muted-foreground w-4 shrink-0 tabular-nums">{index + 1}.</span>
                  <span>{question}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {requirement.optionalQuestions.length > 0 ? (
          <section className="admin-card p-3">
            <h3 className="mb-2 text-sm font-semibold">Optional topics</h3>
            <ol className="space-y-1.5 text-sm">
              {requirement.optionalQuestions.map((question, index) => (
                <li key={`${requirement.requirementId}-o-${index}`} className="flex gap-2">
                  <span className="text-muted-foreground w-4 shrink-0 tabular-nums">{index + 1}.</span>
                  <span>{question}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section className="admin-card p-3">
          <h3 className="mb-2 text-sm font-semibold">
            Sessions ({requirement.linkedInterviews.length})
          </h3>
          {requirement.linkedInterviews.length > 0 ? (
            <ul className="divide-border divide-y">
              {requirement.linkedInterviews.map((interview) => (
                <li key={interview.sessionId} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {interview.candidateName ?? "Awaiting candidate"}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {interview.candidateEmail ?? "No email"} · {interview.interviewDurationDisplay}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <MasterStatusBadge status={interview.status} />
                    {interview.overallScore != null ? (
                      <span className="text-xs font-medium tabular-nums">{interview.overallScore}%</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onOpenSession(interview.sessionId)}
                      className={`${masterRowActionClass} inline-flex items-center gap-1`}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      View
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-xs">No sessions for this opening yet.</p>
          )}
        </section>
      </div>
    </MasterModal>
  );
}
