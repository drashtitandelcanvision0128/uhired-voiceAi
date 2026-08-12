import { NextResponse } from "next/server";
import { z } from "zod";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { prisma } from "@/lib/prisma";
import { writePlatformAuditLog } from "@/lib/platform-audit-log";

type Context = {
  params: Promise<{ requestId: string }>;
};

const patchSchema = z.object({
  status: z.enum(["PROCESSED", "REJECTED"]),
  resultNote: z.string().trim().max(2000).optional(),
});

export async function PATCH(request: Request, context: Context) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { requestId } = await context.params;
  try {
    const body = patchSchema.parse(await request.json());
    const existing = await prisma.dataDeletionRequest.findUnique({ where: { id: requestId } });
    if (!existing) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    const updated = await prisma.dataDeletionRequest.update({
      where: { id: requestId },
      data: {
        status: body.status,
        processedAt: new Date(),
        resultNote: body.resultNote?.trim() || existing.resultNote,
      },
    });

    await writePlatformAuditLog(prisma, {
      level: body.status === "PROCESSED" ? "SUCCESS" : "WARNING",
      category: "PRIVACY",
      title: `Deletion request ${body.status.toLowerCase()}`,
      message: `${existing.email}: ${body.resultNote?.trim() || "Updated by master admin."}`,
      actor: "Master admin",
      metadata: { requestId, status: body.status },
    });

    return NextResponse.json({
      ok: true,
      request: {
        id: updated.id,
        status: updated.status,
        processedAt: updated.processedAt?.toISOString(),
        resultNote: updated.resultNote,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update request." }, { status: 500 });
  }
}
