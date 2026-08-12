import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";

type Context = {
  params: Promise<{ companyId: string }>;
};

export async function DELETE(request: Request, context: Context) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { companyId } = await context.params;
    const existing = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    await prisma.company.delete({ where: { id: companyId } });
    return NextResponse.json({ ok: true, companyName: existing.name });
  } catch {
    return NextResponse.json({ error: "Unable to delete company." }, { status: 500 });
  }
}
