import "server-only";
import { resolve4, resolveMx } from "dns/promises";
import { isValidEmail, normalizeEmail } from "@/lib/parse-candidate-emails";
import type { EmailVerificationResult } from "@/lib/email-verification-shared";

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "throwaway.email",
  "yopmail.com",
  "10minutemail.com",
  "trashmail.com",
  "fakeinbox.com",
  "getnada.com",
  "maildrop.cc",
]);

/** Major providers — skip DNS when local resolver is unavailable. */
const KNOWN_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.in",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "protonmail.com",
  "proton.me",
  "zoho.com",
  "rediffmail.com",
  "aol.com",
]);

type DoHResponse = {
  Status?: number;
  Answer?: Array<{ type: number; data?: string }>;
};

const DNS_TYPE_MX = 15;
const DNS_TYPE_A = 1;
const DNS_NXDOMAIN = 3;

async function lookupViaDoH(domain: string, type: number): Promise<DoHResponse | null> {
  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`;
    const response = await fetch(url, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    return (await response.json()) as DoHResponse;
  } catch {
    return null;
  }
}

async function domainHasMailViaDoH(domain: string): Promise<"valid" | "invalid" | "unknown"> {
  const mx = await lookupViaDoH(domain, DNS_TYPE_MX);
  if (mx?.Status === DNS_NXDOMAIN) return "invalid";
  if (mx?.Answer?.some((row) => row.type === DNS_TYPE_MX)) return "valid";

  const a = await lookupViaDoH(domain, DNS_TYPE_A);
  if (a?.Status === DNS_NXDOMAIN) return "invalid";
  if (a?.Answer?.some((row) => row.type === DNS_TYPE_A)) return "valid";

  if (mx?.Status === 0 || a?.Status === 0) {
    return "unknown";
  }

  return "unknown";
}

async function domainHasMailViaSystemDns(domain: string): Promise<boolean> {
  try {
    const mxRecords = await resolveMx(domain);
    if (mxRecords.length > 0) return true;
  } catch {
    // Fall through to A record / DoH.
  }

  try {
    const aRecords = await resolve4(domain);
    if (aRecords.length > 0) return true;
  } catch {
    // Fall through to DoH.
  }

  return false;
}

async function domainCanReceiveMail(domain: string): Promise<"valid" | "invalid" | "unknown"> {
  if (KNOWN_EMAIL_DOMAINS.has(domain)) {
    return "valid";
  }

  try {
    if (await domainHasMailViaSystemDns(domain)) {
      return "valid";
    }
  } catch {
    // Local DNS often fails on Windows (ECONNREFUSED) — use DoH below.
  }

  return domainHasMailViaDoH(domain);
}

export async function verifyCandidateEmail(email: string): Promise<EmailVerificationResult> {
  const normalized = normalizeEmail(email);
  if (!normalized || !isValidEmail(normalized)) {
    return {
      email: normalized || email,
      valid: false,
      status: "invalid_syntax",
      message: "Email format is incorrect.",
    };
  }

  const domain = normalized.split("@")[1];
  if (!domain) {
    return {
      email: normalized,
      valid: false,
      status: "invalid_syntax",
      message: "Email format is incorrect.",
    };
  }

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      email: normalized,
      valid: false,
      status: "disposable",
      message: "Temporary or disposable email addresses are not allowed.",
    };
  }

  const domainStatus = await domainCanReceiveMail(domain);
  if (domainStatus === "valid") {
    return {
      email: normalized,
      valid: true,
      status: "valid",
      message: KNOWN_EMAIL_DOMAINS.has(domain)
        ? "Known email provider verified."
        : "Email domain verified.",
    };
  }

  if (domainStatus === "invalid") {
    return {
      email: normalized,
      valid: false,
      status: "invalid_domain",
      message: "Email domain does not exist or cannot receive mail.",
    };
  }

  // DNS lookup unavailable — do not block clearly valid addresses.
  return {
    email: normalized,
    valid: true,
    status: "valid",
    message: "Email format verified (domain check was inconclusive).",
  };
}

export async function verifyCandidateEmails(emails: string[]): Promise<EmailVerificationResult[]> {
  const results: EmailVerificationResult[] = [];
  const batchSize = 8;

  for (let index = 0; index < emails.length; index += batchSize) {
    const batch = emails.slice(index, index + batchSize);
    const batchResults = await Promise.all(batch.map((email) => verifyCandidateEmail(email)));
    results.push(...batchResults);
  }

  return results;
}
