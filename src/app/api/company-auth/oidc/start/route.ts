import { NextResponse } from "next/server";
import { setCompanyAdminSessionCookie } from "@/lib/company-admin-auth";
import {
  buildOidcAuthorizationUrl,
  isCompanyOidcConfigured,
} from "@/lib/company-oidc";

export async function GET(request: Request) {
  if (!isCompanyOidcConfigured()) {
    return NextResponse.json({ enabled: false });
  }

  const url = await buildOidcAuthorizationUrl(request);
  if (!url) {
    return NextResponse.json({ enabled: false, error: "OIDC discovery failed." }, { status: 503 });
  }

  return NextResponse.json({ enabled: true, authorizationUrl: url });
}
