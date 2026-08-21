import { NextResponse } from "next/server";
import { z } from "zod";
import { anonymizeCompanySessionsForEmail } from "@/lib/candidate-data-deletion";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { prisma } from "@/lib/prisma";
import { writePlatformAuditLog } from "@/lib/platform-audit-log";

type Context = { params: Promise<{ requestId: string }> };

const bodySchema = z.object({
  action: z.enum(["process", "reject"]),
  note: z.string().trim().max(2000).optional(),
});

export async function PATCH(request: Request, context: Context) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { requestId } = await context.params;
  try {
    const body = bodySchema.parse(await request.json());
    const existing = await prisma.dataDeletionRequest.findUnique({ where: { id: requestId } });
    if (!existing) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }
    if (existing.status !== "PENDING") {
      return NextResponse.json({ error: "Request is already closed." }, { status: 409 });
    }

    if (body.action === "reject") {
      const updated = await prisma.dataDeletionRequest.update({
        where: { id: requestId },
        data: {
          status: "REJECTED",
          processedAt: new Date(),
          resultNote: body.note?.trim() || "Rejected by master admin.",
        },
      });
      await writePlatformAuditLog(prisma, {
        level: "WARNING",
        category: "PRIVACY",
        title: "Data deletion rejected",
        message: `${existing.email}: ${updated.resultNote}`,
        metadata: { requestId },
      });
      return NextResponse.json({ ok: true, status: updated.status });
    }

    const result = await anonymizeCompanySessionsForEmail(prisma, existing.email);
    const resultNote =
      body.note?.trim() ||
      `Company sessions anonymized: ${result.sessionsProcessed}; videos removed: ${result.videosDeleted}.`;

    const updated = await prisma.dataDeletionRequest.update({
      where: { id: requestId },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        resultNote,
      },
    });

    await writePlatformAuditLog(prisma, {
      level: "WARNING",
      category: "PRIVACY",
      title: "Data deletion processed",
      message: `${existing.email}: ${resultNote}`,
      metadata: { requestId, sessionsProcessed: String(result.sessionsProcessed) },
    });

    return NextResponse.json({ ok: true, status: updated.status, result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update deletion request." }, { status: 500 });
  }
}
