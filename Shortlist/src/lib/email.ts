import { randomUUID } from "node:crypto";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { env } from "@/lib/env";
import {
  INVITE_EXPIRY_EMAIL_NOTE,
  INVITE_SINGLE_USE_NOTE,
  formatInviteExpiryForEmail,
} from "@/lib/requirement-invite-expiry";
import {
  getSmtpDeliveryMode,
  isInviteEmailDeliveryConfigured,
  resolveEmailProvider,
  type EmailProvider,
} from "@/lib/smtp-delivery-mode";

type InterviewInviteEmailInput = {
  to: string;
  companyName: string;
  roleTitle: string;
  accessCode: string;
  interviewUrl: string;
  expiresAt: Date;
};

export type InviteEmailSendResult = {
  provider: EmailProvider;
  smtpDeliveryMode: ReturnType<typeof getSmtpDeliveryMode>;
};

const COMPANY_NAME = "Uhired";
const COMPANY_WEBSITE = "https://uhired.in";
const COMPANY_WEBSITE_LABEL = "uhired.in";

function getSmtpConfig() {
  const host = env.smtpHost;
  if (!host) {
    return null;
  }
  const port = env.smtpPort;
  const user = env.smtpUser;
  const pass = env.smtpPass;
  return { host, port, user, pass };
}

function getFromEmailAddress(): string {
  return env.smtpFromEmail || env.smtpUser || "no-reply@uhired.in";
}

function getFromName(): string {
  return env.smtpFromName || COMPANY_NAME;
}

function getFromAddress(): string {
  const explicit = env.smtpFrom;
  if (explicit) return explicit;
  return `${getFromName()} <${getFromEmailAddress()}>`;
}

function getFromMailAddress(): Mail.Address {
  const parsed = parseFromAddress(getFromAddress());
  return parsed.name
    ? { name: parsed.name, address: parsed.email }
    : { address: parsed.email };
}

/** Reply-To must be a monitored inbox — never no-reply (Gmail spam signal). */
function getReplyToAddress(): string | undefined {
  const support = env.supportEmail;
  const fromEmail = getFromEmailAddress().toLowerCase();
  if (!support) return undefined;
  const normalized = support.toLowerCase();
  if (normalized === fromEmail) return undefined;
  if (/^no-?reply@/i.test(support)) return undefined;
  return support;
}

function getMessageIdDomain(): string {
  const fromEmail = getFromEmailAddress();
  const at = fromEmail.lastIndexOf("@");
  if (at > 0) return fromEmail.slice(at + 1);
  return "uhired.in";
}

function generateMessageId(): string {
  return `<${randomUUID()}@${getMessageIdDomain()}>`;
}

function parseFromAddress(from: string): { name?: string; email: string } {
  const match = from.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1]!.trim(), email: match[2]!.trim() };
  }
  return { email: from.trim() };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let cachedTransport: nodemailer.Transporter | null = null;

function getTransport() {
  const smtp = getSmtpConfig();
  if (!smtp) {
    throw new Error("SMTP is not configured. Add SMTP_HOST (and SMTP_PORT) to .env.");
  }
  if (!cachedTransport) {
    cachedTransport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      requireTLS: smtp.port === 587,
      tls: { minVersion: "TLSv1.2" },
      ...(smtp.user && smtp.pass ? { auth: { user: smtp.user, pass: smtp.pass } } : {}),
      // Align EHLO hostname with sending domain when possible.
      name: getMessageIdDomain(),
    });
  }
  return cachedTransport;
}

function getSesClient() {
  const region = env.awsRegion;
  const accessKeyId = env.awsAccessKeyId;
  const secretAccessKey = env.awsSecretAccessKey;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS SES is not configured. Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.");
  }
  return new SESClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export function isEmailConfigured(): boolean {
  return isInviteEmailDeliveryConfigured();
}

export function getActiveEmailProvider(): EmailProvider {
  return resolveEmailProvider();
}

export function getEmailSendDelayMs(): number {
  const fromEnv = env.smtpSendDelayMs;
  if (Number.isFinite(fromEnv) && fromEnv >= 0) {
    return fromEnv;
  }
  return 1500;
}

function getEmailMaxRetries(): number {
  const fromEnv = env.smtpMaxRetries;
  if (Number.isFinite(fromEnv) && fromEnv >= 1) {
    return Math.floor(fromEnv);
  }
  return 5;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /too many emails per second|550\s*5\.7\.0|rate.?limit|throttl/i.test(message);
}

type InviteEmailContent = {
  subject: string;
  text: string;
  html: string;
  preheader: string;
};

function buildInviteEmailContent(input: InterviewInviteEmailInput): InviteEmailContent {
  const expiryLabel = formatInviteExpiryForEmail(input.expiresAt);
  const replyTo = getReplyToAddress();
  const companyName = input.companyName.trim();
  const roleTitle = input.roleTitle.trim();

  const subject = `${companyName} — interview for ${roleTitle}`;
  const preheader = `Your interview code is ${input.accessCode}. Complete your interview before ${expiryLabel} (IST).`;

  const textLines = [
    `Hello,`,
    ``,
    `${companyName} has invited you to complete an interview for the ${roleTitle} role on ${COMPANY_NAME}.`,
    ``,
    `Your interview code: ${input.accessCode}`,
    `Open your interview: ${input.interviewUrl}`,
    ``,
    `${INVITE_EXPIRY_EMAIL_NOTE}`,
    `Expires on: ${expiryLabel} (IST)`,
    `${INVITE_SINGLE_USE_NOTE}`,
    ``,
    `Sign in with this email address: ${input.to}`,
    ...(replyTo ? [``, `Questions? Contact us at ${replyTo}.`] : []),
    ``,
    `— ${COMPANY_NAME}`,
    COMPANY_WEBSITE,
    ``,
    `You received this email because ${companyName} invited you to an interview on ${COMPANY_NAME}.`,
    `This is a transactional message about your interview — not a marketing email.`,
  ];

  const text = textLines.join("\n");

  const safeCompany = escapeHtml(companyName);
  const safeRole = escapeHtml(roleTitle);
  const safeCode = escapeHtml(input.accessCode);
  const safeUrl = escapeHtml(input.interviewUrl);
  const safeEmail = escapeHtml(input.to);
  const safeExpiry = escapeHtml(expiryLabel);
  const safeReplyTo = replyTo ? escapeHtml(replyTo) : "";

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1e293b;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
          <tr>
            <td style="padding:28px 28px 8px;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#006a62;">${COMPANY_NAME}</p>
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;line-height:1.3;color:#0f172a;">Interview for ${safeRole}</h1>
              <p style="margin:0 0 16px;">Hello,</p>
              <p style="margin:0 0 16px;"><strong>${safeCompany}</strong> invited you to complete an interview for the <strong>${safeRole}</strong> role on ${COMPANY_NAME}.</p>
              <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Your interview code</p>
              <p style="margin:0 0 20px;font-size:24px;font-weight:700;letter-spacing:2px;color:#006a62;font-family:Consolas,Monaco,monospace;">${safeCode}</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:8px;background-color:#006a62;">
                    <a href="${safeUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">Open interview</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px;font-size:14px;color:#475569;"><strong>Expires:</strong> ${safeExpiry} (IST). ${escapeHtml(INVITE_EXPIRY_EMAIL_NOTE)} ${escapeHtml(INVITE_SINGLE_USE_NOTE)}</p>
              <p style="margin:0 0 12px;font-size:14px;color:#475569;">Sign in with: <strong>${safeEmail}</strong></p>
              ${replyTo ? `<p style="margin:0 0 12px;font-size:14px;color:#475569;">Questions? Contact <a href="mailto:${safeReplyTo}" style="color:#006a62;">${safeReplyTo}</a>.</p>` : ""}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 8px;font-size:13px;color:#64748b;"><strong>${COMPANY_NAME}</strong> · <a href="${COMPANY_WEBSITE}" style="color:#006a62;text-decoration:none;">${COMPANY_WEBSITE_LABEL}</a></p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">You received this because ${safeCompany} invited you to an interview. This is a transactional message, not marketing.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html, preheader };
}

function buildInviteMail(input: InterviewInviteEmailInput): Mail.Options {
  const content = buildInviteEmailContent(input);
  const from = getFromMailAddress();
  const fromEmail = typeof from === "string" ? from : from.address;
  const replyTo = getReplyToAddress();
  const messageId = generateMessageId();

  return {
    from,
    sender: from,
    to: input.to,
    ...(replyTo ? { replyTo } : {}),
    subject: content.subject,
    text: content.text,
    html: content.html,
    messageId,
    encoding: "utf-8",
    envelope: {
      from: fromEmail,
      to: input.to,
    },
    headers: {
      "X-Mailer": COMPANY_NAME,
      "X-Auto-Response-Suppress": "OOF, AutoReply",
      "Auto-Submitted": "no",
      Precedence: "normal",
      "X-Entity-Ref-ID": messageId,
    },
  };
}

async function sendViaSes(mail: Mail.Options): Promise<void> {
  const from = parseFromAddress(
    typeof mail.from === "string"
      ? mail.from
      : Array.isArray(mail.from)
        ? String(mail.from[0])
        : `${mail.from?.name ? `${mail.from.name} ` : ""}<${mail.from?.address ?? getFromEmailAddress()}>`,
  );
  const source = from.name ? `${from.name} <${from.email}>` : from.email;
  const client = getSesClient();
  const replyTo = mail.replyTo ? String(mail.replyTo) : undefined;
  const configurationSet = env.sesConfigurationSet;

  await client.send(
    new SendEmailCommand({
      Source: source,
      Destination: { ToAddresses: [String(mail.to)] },
      ...(replyTo ? { ReplyToAddresses: [replyTo] } : {}),
      ReturnPath: from.email,
      ...(configurationSet ? { ConfigurationSetName: configurationSet } : {}),
      Message: {
        Subject: { Data: String(mail.subject), Charset: "UTF-8" },
        Body: {
          ...(mail.text ? { Text: { Data: String(mail.text), Charset: "UTF-8" } } : {}),
          ...(mail.html ? { Html: { Data: String(mail.html), Charset: "UTF-8" } } : {}),
        },
      },
    }),
  );
}

async function sendViaSmtp(mail: Mail.Options): Promise<void> {
  const transport = getTransport();
  const maxRetries = getEmailMaxRetries();
  const baseDelayMs = getEmailSendDelayMs();

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      await transport.sendMail(mail);
      return;
    } catch (error) {
      const isLastAttempt = attempt >= maxRetries - 1;
      if (!isRateLimitError(error) || isLastAttempt) {
        throw error;
      }
      const waitMs = baseDelayMs * (attempt + 2);
      await sleep(waitMs);
    }
  }
}

export async function sendInterviewInviteEmail(
  input: InterviewInviteEmailInput,
): Promise<InviteEmailSendResult> {
  const mail = buildInviteMail(input);
  const provider = resolveEmailProvider();

  if (provider === "ses") {
    await sendViaSes(mail);
    return { provider: "ses", smtpDeliveryMode: getSmtpDeliveryMode() };
  }

  await sendViaSmtp(mail);
  return { provider: "smtp", smtpDeliveryMode: getSmtpDeliveryMode() };
}

/** Exported for delivery diagnostics and tests. */
export function buildInviteEmailPreview(input: InterviewInviteEmailInput): InviteEmailContent {
  return buildInviteEmailContent(input);
}

type PortalOtpEmailInput = {
  to: string;
  code: string;
};

export async function sendCandidatePortalOtpEmail(input: PortalOtpEmailInput): Promise<void> {
  const subject = `${COMPANY_NAME} — your interview history login code`;
  const text = [
    `Your login code for ${COMPANY_NAME} interview history is: ${input.code}`,
    "",
    "This code expires in 15 minutes.",
    "",
    `Visit ${COMPANY_WEBSITE}/candidate/history to view your past interviews.`,
  ].join("\n");
  const html = `<p>Your login code is <strong>${input.code}</strong>.</p><p>Expires in 15 minutes.</p>`;

  const mail: Mail.Options = {
    from: getFromMailAddress(),
    to: input.to,
    subject,
    text,
    html,
  };

  const provider = resolveEmailProvider();
  if (provider === "ses") {
    await sendViaSes(mail);
    return;
  }
  await sendViaSmtp(mail);
}

type PromoCodeEmailInput = {
  to: string;
  promoCode: string;
  durationMin: number;
  companyName?: string | null;
  practiceUrl: string;
};

function buildPromoCodeEmailContent(input: PromoCodeEmailInput): InviteEmailContent {
  const companyLabel = input.companyName?.trim() || COMPANY_NAME;
  const subject = `${COMPANY_NAME} — your free practice interview (${input.promoCode})`;
  const preheader = `Start your ${input.durationMin}-minute AI practice interview with code ${input.promoCode}.`;

  const textLines = [
    `Hello,`,
    ``,
    `${companyLabel} has shared a free practice interview with you on ${COMPANY_NAME}.`,
    ``,
    `Promo code: ${input.promoCode}`,
    `Session duration: ${input.durationMin} minutes`,
    ``,
    `Start your interview (link includes your code):`,
    input.practiceUrl,
    ``,
    `Steps:`,
    `1. Open the interview link above`,
    `2. Enter your name and confirm your email (${input.to})`,
    `3. Click "Start Interview" — your promo code is already applied`,
    ``,
    `Important: Use email ${input.to} and select exactly ${input.durationMin} minutes.`,
    ``,
    `— ${COMPANY_NAME}`,
    COMPANY_WEBSITE,
  ];

  const text = textLines.join("\n");
  const safeCompany = escapeHtml(companyLabel);
  const safeCode = escapeHtml(input.promoCode);
  const safeUrl = escapeHtml(input.practiceUrl);
  const safeEmail = escapeHtml(input.to);
  const safeDuration = escapeHtml(String(input.durationMin));

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1e293b;">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
          <tr>
            <td style="padding:28px 28px 8px;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#006a62;">${COMPANY_NAME}</p>
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;">Your free practice interview</h1>
              <p style="margin:0 0 16px;">Hello,</p>
              <p style="margin:0 0 16px;"><strong>${safeCompany}</strong> has shared a free AI practice interview with you.</p>
              <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Your promo code</p>
              <p style="margin:0 0 12px;font-size:24px;font-weight:700;letter-spacing:2px;color:#006a62;font-family:Consolas,Monaco,monospace;">${safeCode}</p>
              <p style="margin:0 0 16px;font-size:14px;color:#475569;"><strong>Duration:</strong> ${safeDuration} minutes</p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px;">
                <tr>
                  <td style="border-radius:8px;background-color:#006a62;">
                    <a href="${safeUrl}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">Start interview now</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px;font-size:13px;color:#64748b;word-break:break-all;">Interview link:<br><a href="${safeUrl}" style="color:#006a62;">${safeUrl}</a></p>
              <p style="margin:0 0 12px;font-size:14px;color:#475569;">Use email: <strong>${safeEmail}</strong></p>
              <p style="margin:0;font-size:13px;color:#94a3b8;">Your promo code is pre-filled in the link. Enter your name and click Start Interview.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 24px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">You received this because ${safeCompany} shared a practice interview code with you on ${COMPANY_NAME}.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html, preheader };
}

export async function sendPromoCodeEmail(input: PromoCodeEmailInput): Promise<InviteEmailSendResult> {
  const content = buildPromoCodeEmailContent(input);
  const from = getFromMailAddress();
  const fromEmail = typeof from === "string" ? from : from.address;
  const replyTo = getReplyToAddress();
  const messageId = generateMessageId();

  const mail: Mail.Options = {
    from,
    sender: from,
    to: input.to,
    ...(replyTo ? { replyTo } : {}),
    subject: content.subject,
    text: content.text,
    html: content.html,
    messageId,
    encoding: "utf-8",
    envelope: { from: fromEmail, to: input.to },
    headers: {
      "X-Mailer": COMPANY_NAME,
      "X-Auto-Response-Suppress": "OOF, AutoReply",
      "Auto-Submitted": "no",
      Precedence: "normal",
      "X-Entity-Ref-ID": messageId,
    },
  };

  const provider = resolveEmailProvider();
  if (provider === "ses") {
    await sendViaSes(mail);
    return { provider: "ses", smtpDeliveryMode: getSmtpDeliveryMode() };
  }
  await sendViaSmtp(mail);
  return { provider: "smtp", smtpDeliveryMode: getSmtpDeliveryMode() };
}
