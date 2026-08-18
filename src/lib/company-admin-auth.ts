import type { CompanyMemberRole } from "@prisma/client";
import type { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { COMPANY_ADMIN_COOKIE } from "@/lib/session-cookies";

export { COMPANY_ADMIN_COOKIE };

export type CompanyAdminSession = {
  companyId: string;
  companyName: string;
  memberId: string;
  memberEmail: string;
  role: CompanyMemberRole;
};

/** 90-minute fixed company admin session window. */
const COMPANY_SESSION_TTL_SEC = 60 * 90;

function stripWhitespace(value: string) {
  return value.replace(/\s+/g, "");
}

export const companyAdminLoginSchema = z.object({
  companyEmail: z
    .string()
    .transform((value) => stripWhitespace(value).toLowerCase())
    .pipe(z.string().email()),
  passcode: z.string().transform(stripWhitespace).pipe(z.string().min(1)),
});

export const companyRegisterSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required."),
  companyDomain: z.string().trim().min(1, "Corporate domain is required."),
  companyEmail: z
    .string()
    .transform((value) => stripWhitespace(value).toLowerCase())
    .pipe(z.string().email("Enter a valid work email.")),
  passcode: z
    .string()
    .transform(stripWhitespace)
    .pipe(z.string().min(6, "Passcode must be at least 6 characters.")),
  honeypot: z.string().optional(),
});

export function normalizeCompanyDomain(domain: string) {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function workEmailMatchesDomain(email: string, domain: string) {
  const emailDomain = email.trim().toLowerCase().split("@")[1];
  if (!emailDomain) {
    return false;
  }
  return emailDomain === normalizeCompanyDomain(domain);
}

function getCompanySessionSecret() {
  return env.companySessionSecret;
}

function utf8ToBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToUtf8(value: string) {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)!;
  }
  return new TextDecoder().decode(bytes);
}

function bytesToBase64Url(bytes: ArrayBuffer) {
  const u8 = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < u8.length; i++) {
    binary += String.fromCharCode(u8[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSha256Base64Url(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToBase64Url(sig);
}

function randomNonceHex(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualAscii(a: string, b: string) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < ea.length; i++) {
    diff |= ea[i]! ^ eb[i]!;
  }
  return diff === 0;
}

export async function createCompanySessionToken(
  input: {
    companyId: string;
    companyName: string;
    memberId: string;
    memberEmail: string;
    role: CompanyMemberRole;
  },
  nowMs = Date.now(),
) {
  const secret = getCompanySessionSecret();
  if (!secret) {
    throw new Error("COMPANY_SESSION_SECRET or ADMIN_PORTAL_KEY must be set to issue company sessions.");
  }
  const exp = Math.floor(nowMs / 1000) + COMPANY_SESSION_TTL_SEC;
  const nonce = randomNonceHex(16);
  const payload = utf8ToBase64Url(
    JSON.stringify({
      companyId: input.companyId,
      companyName: input.companyName,
      memberId: input.memberId,
      memberEmail: input.memberEmail,
      role: input.role,
      exp,
      nonce,
    }),
  );
  const signature = await hmacSha256Base64Url(secret, payload);
  return `${payload}.${signature}`;
}

function getCookieValueFromHeader(header: string | null, name: string) {
  if (!header) {
    return null;
  }
  const pairs = header.split(";");
  for (const pair of pairs) {
    const [rawKey, ...rawValue] = pair.trim().split("=");
    if (rawKey === name) {
      return rawValue.join("=") || "";
    }
  }
  return null;
}

async function parseVerifiedCompanySession(token: string | undefined | null): Promise<CompanyAdminSession | null> {
  const trimmed = token?.trim();
  if (!trimmed) {
    return null;
  }

  const secret = getCompanySessionSecret();
  if (!secret) {
    return null;
  }

  const [payload, signature] = trimmed.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = await hmacSha256Base64Url(secret, payload);
  if (!timingSafeEqualAscii(signature, expectedSignature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlToUtf8(payload)) as {
      companyId?: string;
      companyName?: string;
      memberId?: string;
      memberEmail?: string;
      role?: CompanyMemberRole;
      exp?: number;
    };
    const exp = typeof parsed.exp === "number" ? parsed.exp : 0;
    if (exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (!parsed.companyId || typeof parsed.companyName !== "string") {
      return null;
    }
    return {
      companyId: parsed.companyId,
      companyName: parsed.companyName,
      memberId: parsed.memberId ?? "legacy-admin",
      memberEmail: parsed.memberEmail ?? "",
      role: parsed.role ?? "ADMIN",
    };
  } catch {
    return null;
  }
}

export async function verifyCompanySessionToken(token: string | undefined | null) {
  return (await parseVerifiedCompanySession(token)) !== null;
}

export async function hasCompanyAdminSessionFromCookieHeader(cookieHeader: string | null) {
  return (await getCompanyAdminSessionFromCookieHeader(cookieHeader)) !== null;
}

export async function getCompanyAdminSessionFromCookieHeader(cookieHeader: string | null) {
  const token = getCookieValueFromHeader(cookieHeader, COMPANY_ADMIN_COOKIE);
  return parseVerifiedCompanySession(token);
}

export async function setCompanyAdminSessionCookie(
  response: NextResponse,
  session: Omit<CompanyAdminSession, "memberId" | "memberEmail" | "role"> & {
    memberId: string;
    memberEmail: string;
    role: CompanyMemberRole;
  },
) {
  response.cookies.set({
    name: COMPANY_ADMIN_COOKIE,
    value: await createCompanySessionToken(session),
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: COMPANY_SESSION_TTL_SEC,
  });
}

export function clearCompanyAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: COMPANY_ADMIN_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: 0,
  });
}
