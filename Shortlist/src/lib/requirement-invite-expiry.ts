export const INVITE_EXPIRY_HOURS = 24;
export const INVITE_EXPIRY_MS = INVITE_EXPIRY_HOURS * 60 * 60 * 1000;

export function createInviteExpiresAt(nowMs = Date.now()): Date {
  return new Date(nowMs + INVITE_EXPIRY_MS);
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

export const INVITE_SINGLE_USE_NOTE = "This interview code can only be used once.";
