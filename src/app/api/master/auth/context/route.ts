import { NextResponse } from "next/server";
import {
  getAppEnvironment,
  getAppEnvironmentBadgeClass,
  getAppEnvironmentLabel,
} from "@/lib/app-environment";
import { getLastSuccessfulMasterLogin } from "@/lib/master-login-audit";
import { getMasterAdminEmail } from "@/lib/master-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const environment = getAppEnvironment();
    const adminEmail = getMasterAdminEmail();
    const lastLogin = adminEmail ? await getLastSuccessfulMasterLogin(prisma, adminEmail) : null;

    return NextResponse.json({
      environment,
      environmentLabel: getAppEnvironmentLabel(environment),
      environmentBadgeClass: getAppEnvironmentBadgeClass(environment),
      lastSuccessfulLogin: lastLogin?.createdAt.toISOString() ?? null,
      maskedAdminEmail: adminEmail
        ? adminEmail.replace(/^(.{2}).+(@.+)$/, "$1••••$2")
        : null,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load login context." }, { status: 500 });
  }
}
