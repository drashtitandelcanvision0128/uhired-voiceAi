import { NextResponse } from "next/server";
import {
  getCompanyAdminSessionFromCookieHeader,
  type CompanyAdminSession,
} from "@/lib/company-admin-auth";
import {
  assertCompanyPermission,
  CompanyPermissionError,
  type CompanyPermission,
} from "@/lib/company-rbac";
import { isPhase7bEnabled } from "@/lib/phase-7-enterprise";
import { withCompanyTenantScope } from "@/lib/prisma-tenant-scope";

export async function requireCompanySession(request: Request): Promise<CompanyAdminSession | null> {
  return getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
}

export async function requireCompanyPermission(
  request: Request,
  permission: CompanyPermission,
): Promise<CompanyAdminSession | NextResponse> {
  const session = await requireCompanySession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isPhase7bEnabled()) {
    return session;
  }
  try {
    assertCompanyPermission(session.role, permission);
  } catch (error) {
    if (error instanceof CompanyPermissionError) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    throw error;
  }
  return session;
}

export async function runAsCompanyTenant<T>(
  companyId: string,
  fn: Parameters<typeof withCompanyTenantScope<T>>[1],
): Promise<T> {
  return withCompanyTenantScope(companyId, fn);
}
