"use client";

import {
  Building2,
  Calendar,
  Globe,
  Loader2,
  Mail,
  MessageSquare,
  User,
} from "lucide-react";
import {
  MasterInfoCard,
  MasterModal,
  masterBtnPrimary,
  masterRowActionDangerClass,
} from "@/components/master-ui";

export type SupportInquiryDetail = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  source: "PUBLIC_CONTACT" | "COMPANY_ADMIN";
  status: "NEW" | "READ" | "REPLIED" | "ARCHIVED";
  clientIp: string | null;
  readAt: string | null;
  createdAt: string;
};

const SOURCE_LABELS: Record<SupportInquiryDetail["source"], string> = {
  PUBLIC_CONTACT: "Public contact form",
  COMPANY_ADMIN: "Company admin portal",
};

const STATUS_STYLES: Record<SupportInquiryDetail["status"], string> = {
  NEW: "bg-primary/12 text-primary ring-primary/25",
  READ: "bg-warning/12 text-warning ring-warning/25",
  REPLIED: "bg-success/12 text-success ring-success/25",
  ARCHIVED: "bg-surface/80 text-muted-foreground ring-border",
};

type MasterSupportInquiryModalProps = {
  open: boolean;
  loading: boolean;
  inquiry: SupportInquiryDetail | null;
  updating: boolean;
  onClose: () => void;
  onUpdateStatus: (status: "READ" | "REPLIED" | "ARCHIVED") => void;
  onDelete: () => void;
};

function MetaTile({
  label,
  value,
  icon: Icon,
  children,
}: {
  label: string;
  value?: string;
  icon: typeof User;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface/40 p-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary ring-1 ring-primary/20">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        {children ?? <p className="font-semibold text-foreground">{value}</p>}
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function MasterSupportInquiryModal({
  open,
  loading,
  inquiry,
  updating,
  onClose,
  onUpdateStatus,
  onDelete,
}: MasterSupportInquiryModalProps) {
  return (
    <MasterModal
      open={open}
      onClose={onClose}
      loading={loading}
      size="lg"
      title={inquiry?.subject ?? "Support inquiry"}
      subtitle={
        inquiry
          ? `${SOURCE_LABELS[inquiry.source]} · ${new Date(inquiry.createdAt).toLocaleString()}`
          : "Loading inquiry…"
      }
      badges={
        inquiry ? (
          <>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ${STATUS_STYLES[inquiry.status]}`}
            >
              {inquiry.status}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface/80 px-2.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground ring-1 ring-border">
              {inquiry.source === "PUBLIC_CONTACT" ? (
                <Globe className="h-3 w-3" aria-hidden />
              ) : (
                <Building2 className="h-3 w-3" aria-hidden />
              )}
              {inquiry.source === "PUBLIC_CONTACT" ? "Public" : "Company"}
            </span>
          </>
        ) : null
      }
      headerAction={
        inquiry ? (
          <a
            href={`mailto:${inquiry.email}?subject=Re: ${encodeURIComponent(inquiry.subject)}`}
            className={`${masterBtnPrimary} inline-flex items-center gap-2 !px-4 !py-1.5 !text-xs`}
          >
            <Mail className="h-3.5 w-3.5" aria-hidden />
            Reply via email
          </a>
        ) : null
      }
    >
      {loading && !inquiry ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
          <p className="text-sm font-semibold text-muted-foreground">Loading inquiry…</p>
        </div>
      ) : inquiry ? (
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetaTile label="Name" value={inquiry.name} icon={User} />
            <MetaTile label="Reply via email" icon={Mail}>
              <a
                href={`mailto:${inquiry.email}`}
                className="font-semibold text-primary hover:underline"
              >
                {inquiry.email}
              </a>
            </MetaTile>
            <MetaTile label="Current status" value={inquiry.status} icon={MessageSquare} />
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <MetaTile
              label="Received"
              value={new Date(inquiry.createdAt).toLocaleString()}
              icon={Calendar}
            />
            {inquiry.clientIp ? (
              <MetaTile label="Client IP" value={inquiry.clientIp} icon={Globe} />
            ) : null}
          </section>

          <MasterInfoCard title="Message">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {inquiry.message}
            </p>
          </MasterInfoCard>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {(["READ", "REPLIED", "ARCHIVED"] as const).map((status) => (
              <button
                key={status}
                type="button"
                disabled={updating || inquiry.status === status}
                onClick={() => onUpdateStatus(status)}
                className={`${masterBtnPrimary} !px-4 !py-2 !text-xs disabled:opacity-50`}
              >
                {updating ? "Updating…" : `Mark as ${status}`}
              </button>
            ))}
            <button
              type="button"
              onClick={onDelete}
              className={masterRowActionDangerClass}
            >
              Delete inquiry
            </button>
          </div>
        </div>
      ) : null}
    </MasterModal>
  );
}
