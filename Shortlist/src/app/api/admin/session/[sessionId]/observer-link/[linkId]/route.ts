import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAdminSessionFromCookieHeader } from "@/lib/company-admin-auth";

type Context = {
  params: Promise<{ sessionId: string; linkId: string }>;
};

export async function DELETE(request: Request, context: Context) {
  const { sessionId, linkId } = await context.params;
  const auth = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const link = await prisma.interviewObserverLink.findFirst({
    where: { id: linkId, sessionId, companyId: auth.companyId },
    select: { id: true, revokedAt: true },
  });
  if (!link) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }
  if (link.revokedAt) {
    return NextResponse.json({ ok: true });
  }

  await prisma.interviewObserverLink.update({
    where: { id: linkId },
    data: { revokedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
