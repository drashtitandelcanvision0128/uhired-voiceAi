import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { CANDIDATE_INTERVIEW_COOKIE } from "@/lib/session-cookies";

export { CANDIDATE_INTERVIEW_COOKIE };
const CANDIDATE_INTERVIEW_TTL_SEC = 60 * 60 * 3;

type CandidateInterviewTokenPayload = {
  sessionId: string;
  candidateEmail: string;
  exp: number;
  nonce: string;
};

function getCandidateInterviewSecret() {
  return env.candidateInterviewSessionSecret;
}

/**
 * Company interview APIs must require the candidate session cookie in production.
 * In non-production, guard stays optional so local smoke tests can skip the secret.
 */
export function isCandidateInterviewSessionGuardEnabled() {
  if (env.isProduction) {
    return true;
  }
  return Boolean(getCandidateInterviewSecret());
}

/** Returns a 401 response when COMPANY interview access cookie is missing/mismatched. */
export function getUnauthorizedCompanyInterviewResponse(
  request: Request,
  sessionId: string,
  sessionType: string,
): NextResponse | null {
  if (sessionType !== "COMPANY" || !isCandidateInterviewSessionGuardEnabled()) {
    return null;
  }
  const candidateSession = getCandidateInterviewSessionFromCookieHeader(request.headers.get("cookie"));
  if (!candidateSession || candidateSession.sessionId !== sessionId) {
    return NextResponse.json({ error: "Unauthorized interview session access." }, { status: 401 });
  }
  return null;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string) {
  return createHmac("sha256", getCandidateInterviewSecret()).update(payload).digest("base64url");
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

export function createCandidateInterviewSessionToken(
  sessionId: string,
  candidateEmail: string,
  nowMs = Date.now(),
) {
  const payload: CandidateInterviewTokenPayload = {
    sessionId,
    candidateEmail: candidateEmail.toLowerCase(),
    exp: Math.floor(nowMs / 1000) + CANDIDATE_INTERVIEW_TTL_SEC,
    nonce: randomBytes(16).toString("hex"),
  };
  const encoded = encodeBase64Url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function getCandidateInterviewSessionFromCookieHeader(cookieHeader: string | null) {
  const token = getCookieValueFromHeader(cookieHeader, CANDIDATE_INTERVIEW_COOKIE);
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const sigA = Buffer.from(signature, "utf8");
  const sigB = Buffer.from(expected, "utf8");
  if (sigA.length !== sigB.length || !timingSafeEqual(sigA, sigB)) return null;

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as CandidateInterviewTokenPayload;
    if (!parsed.sessionId || !parsed.candidateEmail || typeof parsed.exp !== "number") return null;
    if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    return {
      sessionId: parsed.sessionId,
      candidateEmail: parsed.candidateEmail.toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function setCandidateInterviewSessionCookie(
  response: NextResponse,
  sessionId: string,
  candidateEmail: string,
) {
  response.cookies.set({
    name: CANDIDATE_INTERVIEW_COOKIE,
    value: createCandidateInterviewSessionToken(sessionId, candidateEmail),
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: CANDIDATE_INTERVIEW_TTL_SEC,
  });
}

export function clearCandidateInterviewSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: CANDIDATE_INTERVIEW_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: 0,
  });
}
