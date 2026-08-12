import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { CANDIDATE_PORTAL_COOKIE } from "@/lib/session-cookies";

const CANDIDATE_PORTAL_TTL_SEC = 60 * 60 * 8;

type CandidatePortalTokenPayload = {
  email: string;
  exp: number;
  nonce: string;
};

function getCandidatePortalSecret() {
  return env.candidateInterviewSessionSecret;
}

export function isCandidatePortalSessionGuardEnabled() {
  return Boolean(getCandidatePortalSecret());
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string) {
  return createHmac("sha256", getCandidatePortalSecret()).update(payload).digest("base64url");
}

function getCookieValueFromHeader(header: string | null, name: string) {
  if (!header) return null;
  const pairs = header.split(";");
  for (const pair of pairs) {
    const [rawKey, ...rawValue] = pair.trim().split("=");
    if (rawKey === name) return rawValue.join("=") || "";
  }
  return null;
}

export function createCandidatePortalSessionToken(email: string, nowMs = Date.now()) {
  const payload: CandidatePortalTokenPayload = {
    email: email.trim().toLowerCase(),
    exp: Math.floor(nowMs / 1000) + CANDIDATE_PORTAL_TTL_SEC,
    nonce: randomBytes(12).toString("hex"),
  };
  const encoded = encodeBase64Url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyCandidatePortalSessionToken(token: string, nowMs = Date.now()) {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(decodeBase64Url(encoded)) as CandidatePortalTokenPayload;
    if (!payload.email || !payload.exp) return null;
    if (payload.exp * 1000 < nowMs) return null;
    return payload.email;
  } catch {
    return null;
  }
}

export function getCandidatePortalEmailFromCookieHeader(cookieHeader: string | null) {
  if (!isCandidatePortalSessionGuardEnabled()) return null;
  const raw = getCookieValueFromHeader(cookieHeader, CANDIDATE_PORTAL_COOKIE);
  if (!raw) return null;
  return verifyCandidatePortalSessionToken(raw);
}

export async function setCandidatePortalSessionCookie(response: NextResponse, email: string) {
  const token = createCandidatePortalSessionToken(email);
  response.cookies.set({
    name: CANDIDATE_PORTAL_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CANDIDATE_PORTAL_TTL_SEC,
  });
}

export function hashPortalOtpCode(code: string) {
  return createHmac("sha256", getCandidatePortalSecret() || "portal-otp")
    .update(code)
    .digest("hex");
}

export function generatePortalOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
