import { env } from "@/lib/env";

const COMPANY_INVITE_TTL_SEC = 60 * 60 * 24 * 7;

type InvitePayload = {
  sessionId: string;
  accessCode: string;
  exp: number;
};
type RequirementInvitePayload = {
  requirementId: string;
  exp: number;
};

function getInviteSecret() {
  return env.companyInviteSecret;
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

export async function createCompanyInviteToken(sessionId: string, accessCode: string, nowMs = Date.now()) {
  const secret = getInviteSecret();
  if (!secret) {
    throw new Error("COMPANY_INVITE_SECRET or COMPANY_SESSION_SECRET or ADMIN_PORTAL_KEY must be set.");
  }
  const exp = Math.floor(nowMs / 1000) + COMPANY_INVITE_TTL_SEC;
  const payload = utf8ToBase64Url(JSON.stringify({ sessionId, accessCode, exp } satisfies InvitePayload));
  const signature = await hmacSha256Base64Url(secret, payload);
  return `${payload}.${signature}`;
}

export async function verifyCompanyInviteToken(
  token: string | undefined | null,
): Promise<InvitePayload | null> {
  const raw = token?.trim();
  if (!raw) return null;

  const secret = getInviteSecret();
  if (!secret) return null;

  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;

  const expected = await hmacSha256Base64Url(secret, payload);
  if (!timingSafeEqualAscii(signature, expected)) return null;

  try {
    const parsed = JSON.parse(base64UrlToUtf8(payload)) as Partial<InvitePayload>;
    if (!parsed.sessionId || !parsed.accessCode || typeof parsed.exp !== "number") {
      return null;
    }
    if (parsed.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      sessionId: parsed.sessionId,
      accessCode: parsed.accessCode,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export async function createRequirementInviteToken(requirementId: string, nowMs = Date.now()) {
  const secret = getInviteSecret();
  if (!secret) {
    throw new Error("COMPANY_INVITE_SECRET or COMPANY_SESSION_SECRET or ADMIN_PORTAL_KEY must be set.");
  }
  const exp = Math.floor(nowMs / 1000) + COMPANY_INVITE_TTL_SEC;
  const payload = utf8ToBase64Url(JSON.stringify({ requirementId, exp } satisfies RequirementInvitePayload));
  const signature = await hmacSha256Base64Url(secret, payload);
  return `${payload}.${signature}`;
}

export async function verifyRequirementInviteToken(
  token: string | undefined | null,
): Promise<RequirementInvitePayload | null> {
  const raw = token?.trim();
  if (!raw) return null;

  const secret = getInviteSecret();
  if (!secret) return null;

  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;

  const expected = await hmacSha256Base64Url(secret, payload);
  if (!timingSafeEqualAscii(signature, expected)) return null;

  try {
    const parsed = JSON.parse(base64UrlToUtf8(payload)) as Partial<RequirementInvitePayload>;
    if (!parsed.requirementId || typeof parsed.exp !== "number") {
      return null;
    }
    if (parsed.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return { requirementId: parsed.requirementId, exp: parsed.exp };
  } catch {
    return null;
  }
}
