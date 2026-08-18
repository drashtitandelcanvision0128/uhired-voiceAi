import { NextResponse } from "next/server";
import { setCompanyAdminSessionCookie } from "@/lib/company-admin-auth";
import { env } from "@/lib/env";
import { findMemberForOidcLogin, touchMemberLogin } from "@/lib/company-members";
import {
  exchangeOidcCode,
  isCompanyOidcConfigured,
  verifyOidcState,
} from "@/lib/company-oidc";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";

export async function GET(request: Request) {
  if (!isCompanyOidcConfigured()) {
    return NextResponse.redirect(new URL("/company-login?error=oidc_disabled", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oidcError = url.searchParams.get("error");

  if (oidcError || !code || !state || !verifyOidcState(state)) {
    return NextResponse.redirect(new URL("/company-login?error=oidc_failed", request.url));
  }

  const profile = await exchangeOidcCode(request, code);
  if (!profile) {
    return NextResponse.redirect(new URL("/company-login?error=oidc_profile", request.url));
  }

  const member = await findMemberForOidcLogin(
    profile.email,
    profile.sub,
    env.companyOidcAutoProvisionRole,
  );

  if (!member) {
    return NextResponse.redirect(new URL("/company-login?error=oidc_no_access", request.url));
  }

  await touchMemberLogin(member.id);

  const redirect = NextResponse.redirect(new URL("/admin/dashboard", getPublicAppBaseUrl(request)));
  try {
    await setCompanyAdminSessionCookie(redirect, {
      companyId: member.company.id,
      companyName: member.company.name,
      memberId: member.id,
      memberEmail: member.email,
      role: member.role,
    });
  } catch {
    return NextResponse.redirect(new URL("/company-login?error=session_config", request.url));
  }
  return redirect;
}
