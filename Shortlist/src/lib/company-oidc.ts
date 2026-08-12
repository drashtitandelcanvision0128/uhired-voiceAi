import { createHmac, randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { isPhase7bEnabled } from "@/lib/phase-7-enterprise";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";

type OidcDiscovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
};

let cachedDiscovery: OidcDiscovery | null | undefined;

export function isCompanyOidcConfigured(): boolean {
  if (!isPhase7bEnabled()) return false;
  return Boolean(
    env.companyOidcIssuer &&
      env.companyOidcClientId &&
      env.companyOidcClientSecret,
  );
}

async function getDiscovery(): Promise<OidcDiscovery | null> {
  if (!isCompanyOidcConfigured()) return null;
  if (cachedDiscovery !== undefined) return cachedDiscovery;

  const issuer = env.companyOidcIssuer.replace(/\/+$/, "");
  const res = await fetch(`${issuer}/.well-known/openid-configuration`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    cachedDiscovery = null;
    return null;
  }
  const json = (await res.json()) as OidcDiscovery;
  cachedDiscovery = json;
  return json;
}

function signOidcState(payload: string): string {
  const sig = createHmac("sha256", env.companySessionSecret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function createOidcState(): string {
  const nonce = randomBytes(16).toString("hex");
  const exp = Math.floor(Date.now() / 1000) + 600;
  const payload = Buffer.from(JSON.stringify({ nonce, exp }), "utf8").toString("base64url");
  return signOidcState(payload);
}

export function verifyOidcState(state: string): boolean {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return false;
  const expected = createHmac("sha256", env.companySessionSecret)
    .update(payload)
    .digest("base64url");
  if (signature !== expected) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof parsed.exp === "number" && parsed.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function buildOidcAuthorizationUrl(request: Request): Promise<string | null> {
  const discovery = await getDiscovery();
  if (!discovery) return null;

  const redirectUri = env.companyOidcRedirectUri || `${getPublicAppBaseUrl(request)}/api/company-auth/oidc/callback`;
  const state = createOidcState();
  const params = new URLSearchParams({
    client_id: env.companyOidcClientId,
    response_type: "code",
    scope: env.companyOidcScopes,
    redirect_uri: redirectUri,
    state,
  });
  return `${discovery.authorization_endpoint}?${params.toString()}`;
}

export type OidcUserProfile = {
  email: string;
  name?: string;
  sub: string;
};

export async function exchangeOidcCode(
  request: Request,
  code: string,
): Promise<OidcUserProfile | null> {
  const discovery = await getDiscovery();
  if (!discovery) return null;

  const redirectUri =
    env.companyOidcRedirectUri || `${getPublicAppBaseUrl(request)}/api/company-auth/oidc/callback`;

  const tokenRes = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: env.companyOidcClientId,
      client_secret: env.companyOidcClientSecret,
    }),
  });

  if (!tokenRes.ok) return null;
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
  };
  if (!tokenJson.access_token || !discovery.userinfo_endpoint) return null;

  const userRes = await fetch(discovery.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!userRes.ok) return null;

  const profile = (await userRes.json()) as {
    sub?: string;
    email?: string;
    name?: string;
  };
  if (!profile.sub || !profile.email) return null;

  return {
    sub: profile.sub,
    email: profile.email.trim().toLowerCase(),
    name: profile.name?.trim() || undefined,
  };
}
