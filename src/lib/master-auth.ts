import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { MASTER_SESSION_COOKIE } from "@/lib/session-cookies";

export { MASTER_SESSION_COOKIE };
export const MASTER_SESSION_TTL_SEC = 60 * 45;
export const MASTER_TRUSTED_SESSION_TTL_SEC = 60 * 60 * 24 * 30;

export const masterAdminLoginSchema = z.object({
  adminEmail: z.string().trim().email(),
  passcode: z.string().trim().min(1),
  trustDevice: z.boolean().optional(),
});

function getMasterAdminKey() {
  return env.masterAdminKey;
}

export function getMasterAdminEmail() {
  return env.masterAdminEmail;
}

function getMasterAdminPassword() {
  return env.masterAdminPassword;
}

export function getMasterAdminPasswordFromEnv() {
  return getMasterAdminPassword();
}

function getMasterSessionSecret() {
  return env.masterSessionSecret || getMasterAdminKey();
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string) {
  return createHmac("sha256", getMasterSessionSecret()).update(payload).digest("base64url");
}

export function assertMasterAdminKey(input: string | null): { ok: true } | { ok: false; error: string } {
  const expected = getMasterAdminKey();
  if (!expected) {
    return { ok: false, error: "MASTER_ADMIN_KEY is not configured." };
  }

  const submitted = (input ?? "").trim();
  if (!submitted) {
    return { ok: false, error: "Enter Master Admin key." };
  }

  if (submitted !== expected) {
    return { ok: false, error: "Invalid Master Admin key." };
  }

  return { ok: true };
}

export function assertMasterAdminCredentials(
  email: string,
  passcode: string,
): { ok: true } | { ok: false; error: string } {
  const expectedEmail = getMasterAdminEmail();
  const expectedPassword = getMasterAdminPassword();

  if (!expectedEmail || !expectedPassword) {
    return {
      ok: false,
      error: "Master admin credentials are not configured.",
    };
  }

  const submittedEmail = email.trim().toLowerCase();
  const submittedPassword = passcode.trim();

  if (!submittedEmail || !submittedPassword) {
    return { ok: false, error: "Email and password are required." };
  }

  if (submittedEmail !== expectedEmail || submittedPassword !== expectedPassword) {
    return { ok: false, error: "Invalid master admin credentials." };
  }

  return { ok: true };
}

export function createMasterSessionToken(nowMs = Date.now(), ttlSec = MASTER_SESSION_TTL_SEC) {
  const exp = Math.floor(nowMs / 1000) + ttlSec;
  const nonce = randomBytes(16).toString("hex");
  const payload = encodeBase64Url(JSON.stringify({ exp, nonce }));
  return `${payload}.${sign(payload)}`;
}

export function getMasterSessionExpiry(token: string | undefined | null) {
  if (!token) return null;

  const [payload] = token.split(".");
  if (!payload) return null;

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as { exp?: number };
    const exp = typeof parsed.exp === "number" ? parsed.exp : 0;
    if (!exp) return null;
    return new Date(exp * 1000);
  } catch {
    return null;
  }
}

export function verifyMasterSessionToken(token: string | undefined | null) {
  if (!token) {
    return false;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return false;
  }

  const expectedSignature = sign(payload);
  const sigA = Buffer.from(signature, "utf8");
  const sigB = Buffer.from(expectedSignature, "utf8");
  if (sigA.length !== sigB.length || !timingSafeEqual(sigA, sigB)) {
    return false;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as { exp?: number };
    const exp = typeof parsed.exp === "number" ? parsed.exp : 0;
    return exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function getCookieValueFromHeader(header: string | null, name: string) {
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

export function hasMasterSessionFromRequest(request: Request) {
  const token = getCookieValueFromHeader(request.headers.get("cookie"), MASTER_SESSION_COOKIE);
  return verifyMasterSessionToken(token);
}

export function setMasterSessionCookie(
  response: NextResponse,
  options?: { trustDevice?: boolean },
) {
  const ttlSec = options?.trustDevice ? MASTER_TRUSTED_SESSION_TTL_SEC : MASTER_SESSION_TTL_SEC;
  response.cookies.set({
    name: MASTER_SESSION_COOKIE,
    value: createMasterSessionToken(Date.now(), ttlSec),
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: ttlSec,
  });
}

export function clearMasterSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: MASTER_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: 0,
  });
}
