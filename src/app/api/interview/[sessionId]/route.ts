import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import type { SessionStatus } from "@prisma/client";
import {
  getCandidateInterviewSessionFromCookieHeader,
  isCandidateInterviewSessionGuardEnabled,
} from "@/lib/candidate-interview-auth";

type Context = {
  params: Promise<{ sessionId: string }>;
};

const patchSchema = z.object({
  status: z.enum(["READY", "LIVE", "ready", "live"]),
  /** When true, go LIVE without setting startedAt (client anchors it to the interview timer). */
  deferStartedAt: z.boolean().optional(),
  /** When true, set startedAt to now if still null (timer start). */
  markStartedAt: z.boolean().optional(),
});

function normalizeStatus(raw: string): SessionStatus {
  const upper = raw.toUpperCase();
  if (upper === "READY" || upper === "LIVE") {
    return upper as SessionStatus;
  }
  return "READY";
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { sessionId } = await context.params;
    const body = patchSchema.parse(await request.json());

    const existing = await withPrismaRetry(() =>
      prisma.interviewSession.findUnique({ where: { id: sessionId } }),
    );
    if (!existing) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }
    if (existing.sessionType === "COMPANY" && isCandidateInterviewSessionGuardEnabled()) {
      const candidateSession = getCandidateInterviewSessionFromCookieHeader(request.headers.get("cookie"));
      if (!candidateSession || candidateSession.sessionId !== sessionId) {
        return NextResponse.json({ error: "Unauthorized interview session access." }, { status: 401 });
      }
    }
    if (existing.status === "COMPLETED" || existing.status === "FAILED") {
      return NextResponse.json(
        { error: "This interview is already finalized and cannot be updated." },
        { status: 409 },
      );
    }

    const nextStatus = normalizeStatus(body.status);

    let nextStartedAt = existing.startedAt;
    if (body.markStartedAt && !existing.startedAt) {
      nextStartedAt = new Date();
    } else if (nextStatus === "LIVE" && !existing.startedAt && !body.deferStartedAt) {
      nextStartedAt = new Date();
    }

    if (nextStatus === "LIVE" && !existing.consentAcceptedAt) {
      return NextResponse.json(
        { error: "Interview consent is required before starting." },
        { status: 403 },
      );
    }

    // CAS: refuse if another request already completed/failed the session.
    const updated = await withPrismaRetry(() =>
      prisma.interviewSession.updateMany({
        where: { id: sessionId, status: { in: ["READY", "LIVE"] } },
        data: {
          status: nextStatus,
          startedAt: nextStartedAt,
        },
      }),
    );
    if (updated.count === 0) {
      return NextResponse.json(
        { error: "This interview is already finalized and cannot be updated." },
        { status: 409 },
      );
    }

    return NextResponse.json({ id: sessionId, status: nextStatus });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update session." }, { status: 500 });
  }
}
