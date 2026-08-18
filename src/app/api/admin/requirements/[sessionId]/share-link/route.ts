import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAdminSessionFromCookieHeader } from "@/lib/company-admin-auth";
import { generateAccessCode } from "@/lib/codes";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";

type Context = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: Request, context: Context) {
  const authCompany = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!authCompany) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId: requirementId } = await context.params;
  const existing = await prisma.requirement.findFirst({
    where: { id: requirementId, companyId: authCompany.companyId, isArchived: false },
    select: { id: true, accessCode: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Opening not found." }, { status: 404 });
  }

  let accessCode = existing.accessCode?.trim() || "";
  if (!accessCode) {
    accessCode = generateAccessCode("REQ");
    while (await prisma.requirement.findUnique({ where: { accessCode }, select: { id: true } })) {
      accessCode = generateAccessCode("REQ");
    }
    await prisma.requirement.update({
      where: { id: existing.id },
      data: { accessCode },
    });
  }

  const shareUrl = `${getPublicAppBaseUrl(request)}/apply/${encodeURIComponent(accessCode)}`;
  return NextResponse.json({ accessCode, shareUrl });
}
