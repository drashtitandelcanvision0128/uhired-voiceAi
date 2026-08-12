import { NextResponse } from "next/server";
import { z } from "zod";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { deleteMasterStuckSession } from "@/lib/master-stuck-sessions";
import { prisma } from "@/lib/prisma";

type Context = {
  params: Promise<{ sessionId: string }>;
};

const patchSchema = z.object({
  action: z.enum(["complete", "reset_to_ready"]),
});

export async function PATCH(request: Request, context: Context) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { sessionId } = await context.params;
    const body = patchSchema.parse(await request.json());

    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    if (body.action === "complete") {
      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          status: "COMPLETED",
          endedAt: new Date(),
        },
      });
    } else {
      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          status: "READY",
          startedAt: null,
          endedAt: null,
        },
      });
    }

    const updated = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, endedAt: true },
    });

    return NextResponse.json({ ok: true, session: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update session." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { sessionId } = await context.params;
    const result = await deleteMasterStuckSession(prisma, sessionId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unable to delete session." }, { status: 500 });
  }
}
