import { env } from "@/lib/env";

export type SmtpDeliveryMode = "live" | "capture";

export type EmailProvider = "smtp" | "ses";

const CAPTURE_SMTP_PORTS = new Set([1025, 8025]);

function getSmtpHost(): string {
  return env.smtpHost.toLowerCase();
}

function getSmtpPort(): number {
  return env.smtpPort;
}

/** True when SMTP accepts mail but does not deliver to real inboxes (Mailpit, Mailtrap, localhost). */
export function getSmtpDeliveryMode(): SmtpDeliveryMode {
  const explicit = env.smtpDeliveryMode;
  if (explicit === "live" || explicit === "capture") {
    return explicit;
  }

  const host = getSmtpHost();
  if (!host) {
    return "capture";
  }

  if (host.includes("mailtrap") || host.includes("mailpit")) {
    return "capture";
  }
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
    return "capture";
  }
  if (CAPTURE_SMTP_PORTS.has(getSmtpPort())) {
    return "capture";
  }

  return "live";
}

export function hasAwsSesCredentials(): boolean {
  return Boolean(env.awsAccessKeyId && env.awsSecretAccessKey);
}

export function resolveEmailProvider(): EmailProvider {
  const explicit = env.emailProvider;
  if (explicit === "ses" || explicit === "smtp") {
    return explicit;
  }

  // Staging/production often ships with Mailpit for local testing — use SES when available.
  if (
    env.isProduction &&
    getSmtpDeliveryMode() === "capture" &&
    hasAwsSesCredentials()
  ) {
    return "ses";
  }

  return "smtp";
}

export function isInviteEmailDeliveryConfigured(): boolean {
  if (resolveEmailProvider() === "ses") {
    return hasAwsSesCredentials();
  }
  return Boolean(env.smtpHost);
}

export const CAPTURE_SMTP_PRODUCTION_ERROR =
  "Email is configured for capture-only SMTP (Mailpit/Mailtrap). On staging/production, set EMAIL_PROVIDER=ses with verified AWS SES credentials, or point SMTP_HOST at a live provider such as AWS SES SMTP.";

export const CAPTURE_SMTP_DEV_NOTE =
  "Captured in dev SMTP inbox only — not delivered to the candidate's real mailbox. Share the interview code manually, or configure live SMTP/SES.";
