/**
 * Edge-runtime session verification for middleware (Web Crypto API).
 * Mirrors signing logic in master-auth / company-admin-auth without Node `crypto`
 * or `server-only` modules (those crash Edge middleware).
 */

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string) {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)!;
  }
  return new TextDecoder().decode(bytes);
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
  return encodeBase64Url(new Uint8Array(sig));
}

function timingSafeEqualAscii(a: string, b: string) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) {
    diff |= ea[i]! ^ eb[i]!;
  }
  return diff === 0;
}

async function verifySignedSessionTokenEdge(
  token: string | undefined | null,
  secret: string,
): Promise<boolean> {
  const trimmed = token?.trim();
  if (!trimmed || !secret) return false;

  const [payload, signature] = trimmed.split(".");
  if (!payload || !signature) return false;

  const expectedSignature = await hmacSha256Base64Url(secret, payload);
  if (!timingSafeEqualAscii(signature, expectedSignature)) return false;

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as { exp?: number };
    const exp = typeof parsed.exp === "number" ? parsed.exp : 0;
    return exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function verifyMasterSessionTokenEdge(
  token: string | undefined | null,
  secret: string,
): Promise<boolean> {
  return verifySignedSessionTokenEdge(token, secret);
}

export async function verifyCompanySessionTokenEdge(
  token: string | undefined | null,
  secret: string,
): Promise<boolean> {
  return verifySignedSessionTokenEdge(token, secret);
}

export function getMasterSessionSecretFromEnv() {
  return process.env.MASTER_SESSION_SECRET?.trim() || process.env.MASTER_ADMIN_KEY?.trim() || "";
}

export function getCompanySessionSecretFromEnv() {
  return process.env.COMPANY_SESSION_SECRET?.trim() || process.env.ADMIN_PORTAL_KEY?.trim() || "";
}
