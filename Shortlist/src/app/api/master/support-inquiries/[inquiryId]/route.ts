import { NextResponse } from "next/server";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { deleteSupportInquiry } from "@/lib/support-inquiry-db";
import { prisma } from "@/lib/prisma";

type Context = {
  params: Promise<{ inquiryId: string }>;
};

export async function DELETE(request: Request, context: Context) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { inquiryId } = await context.params;
    const deleted = await deleteSupportInquiry(prisma, inquiryId);
    if (!deleted) {
      return NextResponse.json({ error: "Support inquiry not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete support inquiry." }, { status: 500 });
  }
}
