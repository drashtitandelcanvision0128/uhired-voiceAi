export type InviteDeliveryStatus =
  | "sent"
  | "captured_dev"
  | "invalid_email"
  | "send_failed"
  | "rate_limited"
  | "sandbox_restricted";

export type InviteDeliveryRow = {
  email: string;
  accessCode?: string;
  status: InviteDeliveryStatus;
  deliveryMessage: string;
  verificationMessage?: string;
};

export type InviteDeliverySummary = {
  total: number;
  sent: number;
  invalid: number;
  failed: number;
};

export function buildInviteDeliverySummary(rows: InviteDeliveryRow[]): InviteDeliverySummary {
  let sent = 0;
  let invalid = 0;
  let failed = 0;
  for (const row of rows) {
    if (row.status === "sent") sent += 1;
    else if (row.status === "invalid_email") invalid += 1;
    else failed += 1;
  }
  return { total: rows.length, sent, invalid, failed };
}

export function classifySmtpError(message: string): InviteDeliveryStatus {
  // AWS SES sandbox / unverified-identity rejections also carry a 554 code, so
  // they must be matched before the generic invalid-recipient check below.
  if (/email address is not verified|identities failed the check|not verified in region/i.test(message)) {
    return "sandbox_restricted";
  }
  if (/not authorized to perform `ses:SendEmail`|ses:SendEmail/i.test(message)) {
    return "send_failed";
  }
  if (/too many emails per second|rate.?limit|throttl/i.test(message)) {
    return "rate_limited";
  }
  if (/535|authentication failed|invalid login|could not authenticate/i.test(message)) {
    return "send_failed";
  }
  if (
    /user unknown|mailbox not found|recipient rejected|invalid recipient|does not exist|no such user|unknown user|550|553|554|552|551/i.test(
      message,
    )
  ) {
    return "invalid_email";
  }
  return "send_failed";
}

export function isSmtpAuthError(message: string): boolean {
  return /535|authentication failed|invalid login|could not authenticate/i.test(message);
}

export function deliveryStatusLabel(status: InviteDeliveryStatus): string {
  switch (status) {
    case "sent":
      return "Sent successfully";
    case "captured_dev":
      return "Dev inbox only — not delivered";
    case "invalid_email":
      return "Incorrect / invalid email";
    case "rate_limited":
      return "Rate limited — try again";
    case "sandbox_restricted":
      return "Not sent — sender in sandbox";
    case "send_failed":
      return "Failed to send";
    default:
      return "Unknown";
  }
}

export const SPAM_FOLDER_NOTE =
  "Spam/Junk folder cannot be detected automatically via SMTP. If a candidate does not receive the email, ask them to check Spam/Junk and Promotions tabs.";

export const SES_IAM_NOTE =
  "AWS IAM user lacks ses:SendEmail permission. Add SES send rights to the IAM user, and verify no-reply@uhired.in in SES (ap-south-1).";

export const SES_SANDBOX_NOTE =
  "Your email provider (AWS SES) is in sandbox mode, so it only delivers to verified addresses. This recipient's email is fine — request SES production access, or verify this address in the SES console, to reach unverified inboxes.";

export const SMTP_AUTH_NOTE =
  "SMTP login failed for no-reply@uhired.in. Webmail login works but app SMTP needs: (1) Titan → Settings (gear) → Enable Titan on Other Apps, (2) 2FA off on this mailbox, (3) SMTP_PASS in .env must be the exact webmail password — reset in GoDaddy Email & Office if unsure, then restart npm run dev.";
