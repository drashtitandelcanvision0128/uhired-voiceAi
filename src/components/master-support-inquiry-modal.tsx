"use client";

import { Building2, Globe, Loader2, Mail } from "lucide-react";
import { MasterModal, masterBtnGhost, masterBtnPrimary, masterRowActionDangerClass } from "@/components/master-ui";

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

const STATUS_STYLES: Record<SupportInquiryDetail["status"], string> = {
  NEW: "bg-primary/12 text-primary ring-1 ring-primary/25",
  READ: "bg-warning/12 text-warning ring-1 ring-warning/25",
  REPLIED: "bg-success/12 text-success ring-1 ring-success/25",
  ARCHIVED: "bg-muted text-muted-foreground ring-1 ring-border",
};

function formatStatus(status: SupportInquiryDetail["status"]) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

type MasterSupportInquiryModalProps = {
  open: boolean;
  loading: boolean;
  inquiry: SupportInquiryDetail | null;
  updating: boolean;
  onClose: () => void;
  onUpdateStatus: (status: "READ" | "REPLIED" | "ARCHIVED") => void;
  onDelete: () => void;
};

export function MasterSupportInquiryModal({
  open,
  loading,
  inquiry,
  updating,
  onClose,
  onUpdateStatus,
  onDelete,
}: MasterSupportInquiryModalProps) {
  const fromWebsite = inquiry?.source === "PUBLIC_CONTACT";

  return (
    <MasterModal
      open={open}
      onClose={onClose}
      loading={loading}
      size="lg"
      title={inquiry?.subject ?? "Message"}
      subtitle={
        inquiry
          ? `${inquiry.name} · ${fromWebsite ? "Website" : "Company"} · ${new Date(inquiry.createdAt).toLocaleString()}`
          : "Loading…"
      }
      badges={
        inquiry ? (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[inquiry.status]}`}>
            {formatStatus(inquiry.status)}
          </span>
        ) : null
      }
      headerAction={
        inquiry ? (
          <a
            href={`mailto:${inquiry.email}?subject=${encodeURIComponent(`Re: ${inquiry.subject}`)}`}
            className={`${masterBtnPrimary} inline-flex items-center gap-1.5 !px-3 !py-1.5 !text-xs`}
          >
            <Mail className="h-3.5 w-3.5" aria-hidden />
            Reply
          </a>
        ) : null
      }
    >
      {loading && !inquiry ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      ) : inquiry ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-bold text-primary">
              {inquiry.name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase() || "U"}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{inquiry.name}</p>
              <a href={`mailto:${inquiry.email}`} className="text-sm text-primary hover:underline">
                {inquiry.email}
              </a>
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                {fromWebsite ? <Globe className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                {fromWebsite ? "Contact form" : "Company admin"}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-muted/60 p-4 ring-1 ring-border">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{inquiry.message}</p>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <button
              type="button"
              disabled={updating || inquiry.status === "READ"}
              onClick={() => onUpdateStatus("READ")}
              className={`${masterBtnGhost} !px-3 !py-1.5 !text-xs disabled:opacity-50`}
            >
              Mark read
            </button>
            <button
              type="button"
              disabled={updating || inquiry.status === "REPLIED"}
              onClick={() => onUpdateStatus("REPLIED")}
              className={`${masterBtnPrimary} !px-3 !py-1.5 !text-xs disabled:opacity-50`}
            >
              Mark replied
            </button>
            <button
              type="button"
              disabled={updating || inquiry.status === "ARCHIVED"}
              onClick={() => onUpdateStatus("ARCHIVED")}
              className={`${masterBtnGhost} !px-3 !py-1.5 !text-xs disabled:opacity-50`}
            >
              Archive
            </button>
            <button type="button" onClick={onDelete} className={`${masterRowActionDangerClass} ml-auto`}>
              Delete
            </button>
          </div>
        </div>
      ) : null}
    </MasterModal>
  );
}
