import { env } from "@/lib/env";

const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

function normalizeBaseUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/\/+$/, "");
  return trimmed || undefined;
}

/**
 * Base URL for links embedded in outbound email.
 * In development, always uses the incoming request origin (e.g. localhost) so
 * invite codes stay on the same server/DB as the admin who sent them.
 * In production, uses INVITE_EMAIL_BASE_URL — never localhost (spam filters).
 */
export function getEmailLinkBaseUrl(request: Request): string {
  const requestOrigin = normalizeBaseUrl(getPublicAppBaseUrl(request));

  if (env.nodeEnv === "development" && requestOrigin) {
    return requestOrigin;
  }

  const explicit =
    normalizeBaseUrl(env.inviteEmailBaseUrl) ||
    normalizeBaseUrl(env.emailLinkBaseUrl);
  if (explicit) return explicit;

  const fromEnv = normalizeBaseUrl(env.publicAppUrl);
  if (fromEnv && !LOCAL_ORIGIN_RE.test(fromEnv)) {
    return fromEnv;
  }

  if (requestOrigin && !LOCAL_ORIGIN_RE.test(requestOrigin)) {
    return requestOrigin;
  }

  return "https://uhired.in";
}

/**
 * Base URL for links returned from API (no trailing slash).
 * In development, prefer the incoming request origin so share links hit the same
 * server and DB as the admin who created them, even if NEXT_PUBLIC_APP_URL points
 * at production.
 */
export function getPublicAppBaseUrl(request: Request): string {
  const fromEnv = env.publicAppUrl.trim().replace(/\/+$/, "");
  const hostHeader = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const host = hostHeader?.split(",")[0]?.trim();
  const proto = (request.headers.get("x-forwarded-proto") ?? "http").split(",")[0]!.trim();
  const requestOrigin = host ? `${proto}://${host}` : "";

  if (env.nodeEnv === "development" && requestOrigin) {
    return requestOrigin;
  }

  if (fromEnv) {
    return fromEnv;
  }
  if (requestOrigin) {
    return requestOrigin;
  }
  return "http://localhost:3000";
}
