import { randomUUID } from "node:crypto";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { readCompanyLogoBytes } from "@/lib/company-logo-for-pdf";
import { env } from "@/lib/env";
import {
  INVITE_EXPIRY_EMAIL_NOTE,
  INVITE_SCHEDULED_ACCESS_NOTE,
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
  scheduledAt?: Date;
  candidateName?: string;
};

export type InviteEmailSendResult = {
  provider: EmailProvider;
  smtpDeliveryMode: ReturnType<typeof getSmtpDeliveryMode>;
};

const COMPANY_NAME = "Uhired";
const COMPANY_WEBSITE = "https://uhired.in";
const COMPANY_WEBSITE_LABEL = "uhired.in";
/** Match candidate entry page theme (`--candidate-accent`, navy CTA). */
const BRAND_ACCENT = "#0e7490";
const BRAND_NAVY = "#0f172a";
const BRAND_MUTED = "#475569";
const BRAND_SOFT = "#f0f9fb";
const BRAND_LOGO_CID = "uhired-logo@uhired.in";

let cachedBrandLogoAttachment: Mail.Attachment | null | undefined;

async function getBrandLogoAttachment(): Promise<Mail.Attachment | null> {
  if (cachedBrandLogoAttachment !== undefined) {
    return cachedBrandLogoAttachment;
  }
  const bytes = await readCompanyLogoBytes();
  if (!bytes) {
    cachedBrandLogoAttachment = null;
    return null;
  }
  cachedBrandLogoAttachment = {
    filename: "uhired-logo.png",
    content: Buffer.from(bytes),
    cid: BRAND_LOGO_CID,
    contentDisposition: "inline",
    contentType: "image/png",
  };
  return cachedBrandLogoAttachment;
}

async function attachBrandLogo(mail: Mail.Options): Promise<Mail.Options> {
  const logo = await getBrandLogoAttachment();
  if (!logo) return mail;
  return {
    ...mail,
    attachments: [...(Array.isArray(mail.attachments) ? mail.attachments : []), logo],
  };
}

function brandLogoHeaderHtml(): string {
  const logoImg = `<img src="cid:${BRAND_LOGO_CID}" width="34" height="34" alt="${COMPANY_NAME}" class="email-logo" style="display:block;border:0;width:34px;height:34px;" />`;
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:10px;">
                    <a href="${COMPANY_WEBSITE}" style="text-decoration:none;">${logoImg}</a>
                  </td>
                  <td valign="middle">
                    <a href="${COMPANY_WEBSITE}" class="email-brand" style="color:${BRAND_NAVY};text-decoration:none;font-size:20px;font-weight:800;letter-spacing:-0.03em;">${COMPANY_NAME} <span style="color:${BRAND_ACCENT};">AI</span></a>
                  </td>
                </tr>
              </table>`;
}

function wrapTransactionalEmailHtml(input: {
  title: string;
  preheader: string;
  innerHtml: string;
  footerNote: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${input.title}</title>
  <style type="text/css">
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    @media (prefers-color-scheme: dark) {
      .email-body, .email-bg { background-color: #0b1220 !important; }
      .email-card { background-color: #111827 !important; border-color: #1f2937 !important; }
      .email-panel { background-color: #0f172a !important; border-color: #1f2937 !important; }
      .email-brand, .email-heading, .email-strong { color: #f8fafc !important; }
      .email-text, .email-muted { color: #94a3b8 !important; }
      .email-label { color: #67e8f9 !important; }
      .email-code { color: #67e8f9 !important; }
      .email-footer-rule { border-top-color: #1f2937 !important; }
      .email-link { color: #67e8f9 !important; }
      .email-btn-cell { background-color: #0e7490 !important; }
      .email-btn { background-color: #0e7490 !important; color: #ffffff !important; }
    }
  </style>
</head>
<body class="email-body" style="margin:0;padding:0;background-color:#eef7fa;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:${BRAND_NAVY};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(input.preheader)}</div>
  <table role="presentation" class="email-bg" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eef7fa;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" class="email-card" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid rgba(29,53,87,0.1);border-radius:18px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(90deg,${BRAND_ACCENT},#1d3557);height:4px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:22px 28px 0;">
              ${brandLogoHeaderHtml()}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 8px;">
              ${input.innerHtml}
            </td>
          </tr>
          <tr>
            <td class="email-footer-rule" style="padding:16px 28px 24px;border-top:1px solid #e2e8f0;">
              <p class="email-muted" style="margin:0 0 6px;font-size:13px;color:#64748b;"><strong class="email-strong" style="color:${BRAND_NAVY};">${COMPANY_NAME} AI</strong> · <a class="email-link" href="${COMPANY_WEBSITE}" style="color:${BRAND_ACCENT};text-decoration:none;">${COMPANY_WEBSITE_LABEL}</a></p>
              <p class="email-muted" style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;">${input.footerNote}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function emailPrimaryButton(href: string, label: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0;">
                <tr>
                  <td align="center" class="email-btn-cell" style="border-radius:12px;background-color:${BRAND_NAVY};">
                    <a href="${href}" class="email-btn" style="display:inline-block;padding:13px 28px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;border-radius:12px;background-color:${BRAND_NAVY};">${label}</a>
                  </td>
                </tr>
              </table>`;
}

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
  const scheduledLabel = input.scheduledAt ? formatInviteExpiryForEmail(input.scheduledAt) : "";
  const replyTo = getReplyToAddress();
  const companyName = input.companyName.trim();
  const roleTitle = input.roleTitle.trim();
  const greetingName = input.candidateName?.trim();
  const helloLine = greetingName ? `Hello ${greetingName},` : "Hello,";
  const isScheduled = Boolean(input.scheduledAt);

  const subject = isScheduled
    ? `${companyName} — interview scheduled for ${roleTitle}`
    : `${companyName} — interview for ${roleTitle}`;
  const preheader = isScheduled
    ? `Your interview is at ${scheduledLabel} (IST). The link opens 10 minutes before.`
    : `Your interview code is ${input.accessCode}. Complete your interview before ${expiryLabel} (IST).`;

  const textLines = isScheduled
    ? [
        helloLine,
        ``,
        `${companyName} scheduled your interview for the ${roleTitle} role on ${COMPANY_NAME}.`,
        ``,
        `Interview time: ${scheduledLabel} (IST)`,
        INVITE_SCHEDULED_ACCESS_NOTE,
        ``,
        `Your interview code: ${input.accessCode}`,
        `Open your interview: ${input.interviewUrl}`,
        ``,
        `Window closes: ${expiryLabel} (IST)`,
        INVITE_SINGLE_USE_NOTE,
        ``,
        `Sign in with this email address: ${input.to}`,
        ...(replyTo ? [``, `Questions? Contact us at ${replyTo}.`] : []),
        ``,
        `— ${COMPANY_NAME}`,
        COMPANY_WEBSITE,
        ``,
        `You received this email because ${companyName} scheduled your interview on ${COMPANY_NAME}.`,
        `This is a transactional message about your interview — not a marketing email.`,
      ]
    : [
        helloLine,
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
  const safeScheduled = escapeHtml(scheduledLabel);
  const safeReplyTo = replyTo ? escapeHtml(replyTo) : "";
  const safeHello = escapeHtml(helloLine);
  const heading = isScheduled ? `Interview scheduled for ${safeRole}` : `Interview for ${safeRole}`;
  const intro = isScheduled
    ? `<strong>${safeCompany}</strong> scheduled your interview for the <strong>${safeRole}</strong> role on ${COMPANY_NAME}.`
    : `<strong>${safeCompany}</strong> invited you to complete an interview for the <strong>${safeRole}</strong> role on ${COMPANY_NAME}.`;
  const scheduleBox = isScheduled
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;background-color:${BRAND_SOFT};border:1px solid rgba(14,116,144,0.2);border-radius:12px;">
                <tr>
                  <td class="email-panel" style="padding:14px 16px;background-color:${BRAND_SOFT};">
                    <p class="email-label" style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND_ACCENT};">Interview time (IST)</p>
                    <p class="email-heading" style="margin:0 0 6px;font-size:18px;font-weight:800;color:${BRAND_NAVY};">${safeScheduled}</p>
                    <p class="email-text" style="margin:0;font-size:13px;color:${BRAND_MUTED};">${escapeHtml(INVITE_SCHEDULED_ACCESS_NOTE)}</p>
                  </td>
                </tr>
              </table>`
    : "";
  const expiryCopy = isScheduled
    ? `<strong class="email-strong" style="color:${BRAND_NAVY};">Window closes:</strong> ${safeExpiry} (IST). ${escapeHtml(INVITE_SINGLE_USE_NOTE)}`
    : `<strong class="email-strong" style="color:${BRAND_NAVY};">Expires:</strong> ${safeExpiry} (IST). ${escapeHtml(INVITE_EXPIRY_EMAIL_NOTE)} ${escapeHtml(INVITE_SINGLE_USE_NOTE)}`;

  const innerHtml = `
              <p class="email-label" style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${BRAND_ACCENT};">Interview invitation</p>
              <h1 class="email-heading" style="margin:0 0 8px;font-size:26px;font-weight:800;line-height:1.2;letter-spacing:-0.02em;color:${BRAND_NAVY};">${heading}</h1>
              <p class="email-text" style="margin:0 0 6px;color:${BRAND_MUTED};">${safeHello}</p>
              <p class="email-text" style="margin:0 0 20px;color:${BRAND_MUTED};">${intro}</p>
              ${scheduleBox}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;background-color:#f8fafc;border:1px solid rgba(29,53,87,0.1);border-radius:14px;">
                <tr>
                  <td class="email-panel" align="center" style="padding:20px 16px;background-color:#f8fafc;">
                    <p class="email-muted" style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;">Interview session code</p>
                    <p class="email-code" style="margin:0 0 16px;font-size:22px;font-weight:800;letter-spacing:2px;color:${BRAND_ACCENT};font-family:Consolas,Monaco,monospace;">${safeCode}</p>
                    ${emailPrimaryButton(safeUrl, "Start my interview")}
                  </td>
                </tr>
              </table>
              <p class="email-text" style="margin:0 0 10px;font-size:14px;color:${BRAND_MUTED};">${expiryCopy}</p>
              <p class="email-text" style="margin:0 0 10px;font-size:14px;color:${BRAND_MUTED};">Sign in with: <a class="email-link" href="mailto:${safeEmail}" style="color:${BRAND_ACCENT};font-weight:700;text-decoration:none;">${safeEmail}</a></p>
              ${replyTo ? `<p class="email-text" style="margin:0;font-size:14px;color:${BRAND_MUTED};">Questions? Write to <a class="email-link" href="mailto:${safeReplyTo}" style="color:${BRAND_ACCENT};text-decoration:none;">${safeReplyTo}</a>.</p>` : ""}
  `;

  const html = wrapTransactionalEmailHtml({
    title: escapeHtml(subject),
    preheader,
    innerHtml,
    footerNote: `You received this because ${safeCompany} invited you to an interview on ${COMPANY_NAME}. This is a transactional message, not marketing.`,
  });

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

async function compileMailToRawBuffer(mail: Mail.Options): Promise<Buffer> {
  const transport = nodemailer.createTransport({
    streamTransport: true,
    newline: "unix",
    buffer: true,
  });
  const info = await transport.sendMail(mail);
  const raw = info.message;
  if (Buffer.isBuffer(raw)) return raw;
  return Buffer.from(String(raw));
}

async function sendViaSes(mail: Mail.Options): Promise<void> {
  const client = getSesClient();
  const configurationSet = env.sesConfigurationSet;
  const raw = await compileMailToRawBuffer(mail);

  await client.send(
    new SendRawEmailCommand({
      RawMessage: { Data: raw },
      ...(configurationSet ? { ConfigurationSetName: configurationSet } : {}),
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
  const mail = await attachBrandLogo(buildInviteMail(input));
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

  const innerHtml = `
              <p class="email-label" style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${BRAND_ACCENT};">Practice interview</p>
              <h1 class="email-heading" style="margin:0 0 18px;font-size:26px;font-weight:800;line-height:1.2;letter-spacing:-0.02em;color:${BRAND_NAVY};">Your free practice interview</h1>
              <p class="email-text" style="margin:0 0 6px;color:${BRAND_MUTED};">Hello,</p>
              <p class="email-text" style="margin:0 0 20px;color:${BRAND_MUTED};"><strong class="email-strong" style="color:${BRAND_NAVY};">${safeCompany}</strong> has shared a free AI practice interview with you on ${COMPANY_NAME}.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;background-color:#f8fafc;border:1px solid rgba(29,53,87,0.1);border-radius:14px;">
                <tr>
                  <td class="email-panel" align="center" style="padding:20px 16px;background-color:#f8fafc;">
                    <p class="email-muted" style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;">Your promo code</p>
                    <p class="email-code" style="margin:0 0 8px;font-size:22px;font-weight:800;letter-spacing:2px;color:${BRAND_ACCENT};font-family:Consolas,Monaco,monospace;">${safeCode}</p>
                    <p class="email-text" style="margin:0 0 16px;font-size:14px;color:${BRAND_MUTED};"><strong class="email-strong" style="color:${BRAND_NAVY};">Duration:</strong> ${safeDuration} minutes</p>
                    ${emailPrimaryButton(safeUrl, "Start my interview")}
                  </td>
                </tr>
              </table>
              <p class="email-text" style="margin:0 0 10px;font-size:14px;color:${BRAND_MUTED};">Use this email: <a class="email-link" href="mailto:${safeEmail}" style="color:${BRAND_ACCENT};font-weight:700;text-decoration:none;">${safeEmail}</a></p>
              <p class="email-muted" style="margin:0;font-size:13px;color:#64748b;">Your promo code is already in the link. Enter your name and click Start Interview.</p>
  `;

  const html = wrapTransactionalEmailHtml({
    title: escapeHtml(subject),
    preheader,
    innerHtml,
    footerNote: `You received this because ${safeCompany} shared a practice interview code with you on ${COMPANY_NAME}.`,
  });

  return { subject, text, html, preheader };
}

export async function sendPromoCodeEmail(input: PromoCodeEmailInput): Promise<InviteEmailSendResult> {
  const content = buildPromoCodeEmailContent(input);
  const from = getFromMailAddress();
  const fromEmail = typeof from === "string" ? from : from.address;
  const replyTo = getReplyToAddress();
  const messageId = generateMessageId();

  const mail = await attachBrandLogo({
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
  });

  const provider = resolveEmailProvider();
  if (provider === "ses") {
    await sendViaSes(mail);
    return { provider: "ses", smtpDeliveryMode: getSmtpDeliveryMode() };
  }
  await sendViaSmtp(mail);
  return { provider: "smtp", smtpDeliveryMode: getSmtpDeliveryMode() };
}
