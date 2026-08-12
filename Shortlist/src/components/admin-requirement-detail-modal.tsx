"use client";

import {
  ArrowRight,
  Briefcase,
  Calendar,
  Clock,
  Copy,
  FileText,
  Hash,
  ListChecks,
  Target,
  Users,
} from "lucide-react";
import {
  MasterCard,
  MasterModal,
  MasterStatusBadge,
  masterBtnGhost,
  masterRowActionClass,
  masterTableHeadClass,
} from "@/components/master-ui";

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
  candidateInvites: Array<{
    email: string;
    accessCode: string;
    emailSentAt: string | null;
    usedAt: string | null;
    expiresAt: string | null;
  }>;
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

type InviteStatus = "Used" | "Sent" | "Pending" | "Expired";

type AdminRequirementDetailModalProps = {
  open: boolean;
  requirement: AdminRequirementDetail | null;
  onClose: () => void;
  onCopyLegacyCode: (code: string) => void;
  onOpenSession: (sessionId: string) => void;
};

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getInviteStatus(invite: {
  usedAt: string | null;
  emailSentAt: string | null;
  expiresAt: string | null;
}): InviteStatus {
  if (invite.usedAt) return "Used";
  if (invite.expiresAt) {
    const t = new Date(invite.expiresAt).getTime();
    if (Number.isFinite(t) && t <= Date.now()) return "Expired";
  }
  if (invite.emailSentAt) return "Sent";
  return "Pending";
}

function inviteStatusChipClass(status: InviteStatus): string {
  switch (status) {
    case "Used":
      return "bg-success/12 text-success ring-success/25";
    case "Sent":
      return "bg-primary/12 text-primary ring-primary/25";
    case "Expired":
      return "bg-warning/12 text-warning ring-warning/25";
    default:
      return "bg-surface/80 text-muted-foreground ring-border";
  }
}

function inviteStatusDotClass(status: InviteStatus): string {
  switch (status) {
    case "Used":
      return "bg-success";
    case "Sent":
      return "bg-primary";
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

function roleInitials(title: string | null, domain: string) {
  const source = (title ?? domain).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || "?";
}

function candidateInitials(name: string | null, email?: string | null) {
  const source = (name?.trim() || email?.trim() || "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function MetaField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Briefcase;
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

export function AdminRequirementDetailModal({
  open,
  requirement,
  onClose,
  onCopyLegacyCode,
  onOpenSession,
}: AdminRequirementDetailModalProps) {
  if (!requirement) {
    return (
      <MasterModal
        open={open}
        onClose={onClose}
        title="Requirement view"
        subtitle="Loading…"
      >
        {null}
      </MasterModal>
    );
  }

  const roleLabel = requirement.title ?? requirement.domain;
  const skills = parseKeySkills(requirement.keySkills);

  return (
    <MasterModal
      open={open}
      onClose={onClose}
      size="xl"
      ariaLabelledBy="admin-requirement-detail-title"
      title="Requirement view"
      subtitle={`${roleLabel} · ${requirement.durationMin} min · ${requirement.sessionsCount} session${requirement.sessionsCount === 1 ? "" : "s"}`}
      badges={
        <>
          <span className="inline-flex items-center rounded-full bg-violet/12 px-2.5 py-0.5 text-[10px] font-bold uppercase text-violet ring-1 ring-violet/25">
            Template
          </span>
          <span className="inline-flex items-center rounded-full bg-surface/80 px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground ring-1 ring-border">
            {requirement.mandatoryQuestions.length} mandatory · {requirement.optionalQuestions.length} optional
          </span>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-primary/8 via-surface/40 to-violet/8 p-4 sm:p-5">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-black text-primary-foreground shadow-[var(--shadow-glow)]"
            style={{ background: "var(--gradient-brand)" }}
          >
            {roleInitials(requirement.title, requirement.domain)}
          </div>
          <div className="min-w-0">
            <p className="text-lg font-extrabold tracking-tight text-foreground">{roleLabel}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{requirement.topic}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                {requirement.durationMin} min slot
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" aria-hidden />
                Created {formatDateTime(requirement.createdAt)}
              </span>
            </p>
          </div>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetaField label="Role" value={roleLabel} icon={Briefcase} />
          <MetaField label="Domain" value={requirement.domain} icon={Target} />
          <MetaField label="Topic" value={requirement.topic} icon={FileText} />
          <MetaField
            label="Sessions"
            value={`${requirement.sessionsCount} linked`}
            icon={Users}
          />
        </section>

        {requirement.jobDescription?.trim() ? (
          <MasterCard title="Job description" elevated>
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {requirement.jobDescription.trim()}
            </p>
          </MasterCard>
        ) : null}

        {skills.length > 0 ? (
          <MasterCard title="Key skills" elevated>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs font-semibold text-foreground"
                >
                  {skill}
                </span>
              ))}
            </div>
          </MasterCard>
        ) : null}

        <MasterCard
          title="Candidate invites"
          subtitle="Codes, status, and delivery timestamps"
          elevated
          headerAction={
            requirement.requirementAccessCode ? (
              <button
                type="button"
                onClick={() => onCopyLegacyCode(requirement.requirementAccessCode!)}
                className={`${masterBtnGhost} inline-flex items-center gap-1.5 !px-3 !py-1.5 !text-xs`}
                title="Copy legacy shared code"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                Copy legacy code
              </button>
            ) : null
          }
        >
          {requirement.candidateInvites?.length ? (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className={masterTableHeadClass}>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Sent</th>
                    <th className="px-4 py-3">Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {requirement.candidateInvites.map((invite) => {
                    const status = getInviteStatus(invite);
                    return (
                      <tr key={`${invite.email}-${invite.accessCode}`} className="align-middle">
                        <td className="px-4 py-3">
                          <p className="max-w-[220px] truncate font-medium text-foreground">
                            {invite.email}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <code className="admin-code-badge admin-code-badge-sm">{invite.accessCode}</code>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${inviteStatusChipClass(status)}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${inviteStatusDotClass(status)}`}
                            />
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDateShort(invite.emailSentAt)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDateShort(invite.usedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface/40 px-4 py-4 text-sm text-muted-foreground">
              {requirement.requirementAccessCode ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Hash className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="font-semibold text-foreground">Legacy shared code:</span>
                  <code className="admin-code-badge admin-code-badge-sm">
                    {requirement.requirementAccessCode}
                  </code>
                </div>
              ) : (
                "No candidate invites sent yet."
              )}
            </div>
          )}
        </MasterCard>

        <MasterCard
          title="Mandatory questions"
          subtitle={`${requirement.mandatoryQuestions.length} question${requirement.mandatoryQuestions.length === 1 ? "" : "s"} configured`}
          elevated
          headerAction={<ListChecks className="h-4 w-4 text-primary" aria-hidden />}
        >
          <div className="space-y-3">
            {requirement.mandatoryQuestions.map((question, index) => (
              <div
                key={`${requirement.requirementId}-m-${index}`}
                className="flex gap-3 rounded-xl border border-border bg-surface/30 p-4"
              >
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  {index + 1}
                </div>
                <p className="text-sm leading-relaxed text-foreground">{question}</p>
              </div>
            ))}
          </div>
        </MasterCard>

        <MasterCard
          title="Optional interview topics"
          subtitle={`Max ${requirement.maxOptionalQuestions} asked per interview`}
          elevated
        >
          {requirement.optionalQuestions.length > 0 ? (
            <ul className="space-y-3">
              {requirement.optionalQuestions.map((question, index) => (
                <li
                  key={`${requirement.requirementId}-o-${index}`}
                  className="flex gap-3 rounded-xl border border-border bg-surface/30 p-4"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold text-muted-foreground ring-1 ring-border">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">{question}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-border bg-surface/40 p-4 text-sm text-muted-foreground">
              No optional topics configured for this requirement.
            </p>
          )}
        </MasterCard>

        <MasterCard
          title="Linked interviews"
          subtitle={`${requirement.linkedInterviews.length} session${requirement.linkedInterviews.length === 1 ? "" : "s"} for this requirement`}
          elevated
          headerAction={
            <span className="rounded-full bg-surface/80 px-2.5 py-0.5 text-[10px] font-bold text-muted-foreground ring-1 ring-border">
              {requirement.linkedInterviews.length}
            </span>
          }
        >
          {requirement.linkedInterviews.length > 0 ? (
            <ul className="space-y-3">
              {requirement.linkedInterviews.map((interview) => (
                <li
                  key={interview.sessionId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/30 p-4 transition hover:border-primary/25 hover:bg-surface/50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-xs font-bold text-primary ring-1 ring-primary/25">
                      {candidateInitials(interview.candidateName, interview.candidateEmail)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground">
                        {interview.candidateName ?? interview.candidateEmail ?? "Unnamed candidate"}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <MasterStatusBadge status={interview.status} />
                        {interview.overallScore != null ? (
                          <span className="font-black text-success">{interview.overallScore}% match</span>
                        ) : null}
                        <span>{interview.interviewDurationDisplay}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenSession(interview.sessionId)}
                    className={`${masterRowActionClass} inline-flex items-center gap-1.5`}
                  >
                    Open session
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-border bg-surface/40 p-4 text-sm text-muted-foreground">
              No interviews linked to this requirement yet.
            </p>
          )}
        </MasterCard>
      </div>
    </MasterModal>
  );
}
