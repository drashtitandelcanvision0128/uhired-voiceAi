import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAdminSessionFromCookieHeader } from "@/lib/company-admin-auth";

type Context = {
  params: Promise<{ linkId: string }>;
};

export async function DELETE(_request: Request, context: Context) {
  const { linkId } = await context.params;
  const auth = await getCompanyAdminSessionFromCookieHeader(_request.headers.get("cookie"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const link = await prisma.scorecardShareLink.findFirst({
    where: { id: linkId, companyId: auth.companyId },
  });
  if (!link) {
    return NextResponse.json({ error: "Share link not found." }, { status: 404 });
  }
  if (link.revokedAt) {
    return NextResponse.json({ ok: true });
  }

  await prisma.scorecardShareLink.updateMany({
    where: { id: linkId, companyId: auth.companyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
