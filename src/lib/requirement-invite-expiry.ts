export const INVITE_EXPIRY_HOURS = 24;
export const INVITE_EXPIRY_MS = INVITE_EXPIRY_HOURS * 60 * 60 * 1000;
export const SHARE_APPLY_HOLD_DAYS = 30;
export const SCHEDULE_EARLY_ACCESS_MS = 10 * 60 * 1000;
export const SCHEDULE_GRACE_AFTER_MS = 30 * 60 * 1000;

export function createInviteExpiresAt(nowMs = Date.now()): Date {
  return new Date(nowMs + INVITE_EXPIRY_MS);
}

export function createShareApplyHoldExpiresAt(nowMs = Date.now()): Date {
  return new Date(nowMs + SHARE_APPLY_HOLD_DAYS * 24 * 60 * 60 * 1000);
}

export function createScheduledInviteExpiresAt(scheduledAt: Date, durationMin: number): Date {
  const durationMs = Math.max(5, durationMin) * 60 * 1000;
  return new Date(scheduledAt.getTime() + durationMs + SCHEDULE_GRACE_AFTER_MS);
}

export function isInviteExpired(
  expiresAt: Date | string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!expiresAt) return false;
  const ms = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime();
  if (Number.isNaN(ms)) return false;
  return ms <= nowMs;
}

export function formatInviteExpiryForEmail(expiresAt: Date | string): string {
  const date = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
}

export const INVITE_EXPIRY_EMAIL_NOTE = `This code and link expire ${INVITE_EXPIRY_HOURS} hours after the invite email is sent.`;

export const INVITE_SCHEDULED_ACCESS_NOTE =
  "This link opens 10 minutes before the scheduled time and will not work earlier.";

export const INVITE_SINGLE_USE_NOTE = "This interview code can only be used once.";

export type InviteAccessState =
  | { allowed: true }
  | { allowed: false; reason: "not_scheduled" | "too_early" | "expired"; message: string; opensAt?: Date };

function parseTimeMs(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function getInviteAccessState(
  invite: {
    source?: string | null;
    scheduledAt?: Date | string | null;
    expiresAt?: Date | string | null;
  },
  nowMs = Date.now(),
): InviteAccessState {
  const scheduledMs = parseTimeMs(invite.scheduledAt);
  const expiresMs = parseTimeMs(invite.expiresAt);

  if (scheduledMs != null) {
    const opensAt = new Date(scheduledMs - SCHEDULE_EARLY_ACCESS_MS);
    if (nowMs < opensAt.getTime()) {
      return {
        allowed: false,
        reason: "too_early",
        opensAt,
        message: `This interview opens at ${formatInviteExpiryForEmail(opensAt)} (IST). Please join at the scheduled time.`,
      };
    }
    if (expiresMs != null && nowMs >= expiresMs) {
      return {
        allowed: false,
        reason: "expired",
        message: "This interview window has closed. Ask the company to reschedule.",
      };
    }
    return { allowed: true };
  }

  if ((invite.source ?? "email") === "share") {
    return {
      allowed: false,
      reason: "not_scheduled",
      message:
        "Your interview has not been scheduled yet. The recruiter will email you the time and a personal link.",
    };
  }

  if (expiresMs != null && nowMs >= expiresMs) {
    return {
      allowed: false,
      reason: "expired",
      message: "This interview code has expired. Please ask the company to send a new invite.",
    };
  }

  return { allowed: true };
}
