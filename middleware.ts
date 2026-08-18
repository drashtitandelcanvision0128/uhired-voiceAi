import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COMPANY_ADMIN_COOKIE } from "@/lib/session-cookies";
import { verifyCompanySessionToken } from "@/lib/company-admin-auth";
import {
  getMasterSessionSecretFromEnv,
  verifyMasterSessionTokenEdge,
} from "@/lib/edge-session-verify";
import { MASTER_SESSION_COOKIE } from "@/lib/session-cookies";

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(self), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https: wss:; frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'",
};

function applySecurityHeaders(response: NextResponse) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const companyCookie = request.cookies.get(COMPANY_ADMIN_COOKIE)?.value?.trim() ?? "";
  const isCompanyAuthenticated = await verifyCompanySessionToken(companyCookie);

  const masterSecret = getMasterSessionSecretFromEnv();
  const masterCookie = request.cookies.get(MASTER_SESSION_COOKIE)?.value?.trim() ?? "";
  const isMasterAuthenticated = await verifyMasterSessionTokenEdge(masterCookie, masterSecret);

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!isCompanyAuthenticated) {
      if (pathname.startsWith("/api/admin")) {
        return applySecurityHeaders(
          NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        );
      }
      return applySecurityHeaders(
        NextResponse.redirect(new URL("/company-login", request.url)),
      );
    }
  }

  if (
    (pathname === "/company-login" || pathname === "/company-register") &&
    isCompanyAuthenticated
  ) {
    return applySecurityHeaders(NextResponse.redirect(new URL("/admin/dashboard", request.url)));
  }

  if (pathname === "/sessions" || pathname === "/profile") {
    const destination = isCompanyAuthenticated ? "/admin/dashboard" : "/company-login";
    return applySecurityHeaders(NextResponse.redirect(new URL(destination, request.url)));
  }

  const isMasterProtectedPage =
    pathname.startsWith("/master") && !pathname.startsWith("/master-login");
  const isMasterProtectedApi =
    pathname.startsWith("/api/master") && !pathname.startsWith("/api/master/auth/login");

  if ((isMasterProtectedPage || isMasterProtectedApi) && !isMasterAuthenticated) {
    if (isMasterProtectedApi) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
      );
    }
    return applySecurityHeaders(
      NextResponse.redirect(new URL("/master-login", request.url)),
    );
  }

  if (pathname === "/master-login" && isMasterAuthenticated) {
    return applySecurityHeaders(NextResponse.redirect(new URL("/master", request.url)));
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
    "/company-login",
    "/company-register",
    "/sessions",
    "/profile",
    "/master",
    "/master/:path*",
    "/api/master/:path*",
    "/master-login",
  ],
};
