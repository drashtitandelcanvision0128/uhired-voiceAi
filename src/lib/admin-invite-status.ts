export type AdminInviteStatus = "Used" | "Sent" | "Pending" | "Expired" | "Applied" | "Scheduled";

export function getAdminInviteStatus(invite: {
  usedAt: string | null;
  emailSentAt: string | null;
  expiresAt: string | null;
  scheduledAt?: string | null;
  source?: string | null;
}): AdminInviteStatus {
  if (invite.usedAt) return "Used";
  if (invite.expiresAt) {
    const t = new Date(invite.expiresAt).getTime();
    if (Number.isFinite(t) && t <= Date.now()) return "Expired";
  }
  if (invite.scheduledAt) return "Scheduled";
  if ((invite.source ?? "email") === "share") return "Applied";
  if (invite.emailSentAt) return "Sent";
  return "Pending";
}

export function isOpenInviteStatus(status: AdminInviteStatus): boolean {
  return status === "Sent" || status === "Pending" || status === "Applied" || status === "Scheduled";
}
