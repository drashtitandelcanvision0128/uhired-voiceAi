import { NextResponse } from "next/server";
import { z } from "zod";
import { deletePracticeDataForEmail } from "@/lib/candidate-data-deletion";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimitAsync,
  getClientIpFromRequest,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { writePlatformAuditLog } from "@/lib/platform-audit-log";

const bodySchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  confirmEmail: z.string().trim().email(),
  reason: z.string().trim().max(2000).optional(),
  honeypot: z.string().optional(),
});

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const clientIp = getClientIpFromRequest(request);
  const rate = await checkRateLimitAsync("privacy-delete", clientIp, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(rateLimitResponse(rate.retryAfterSec), { status: 429 });
  }

  try {
    const body = bodySchema.parse(await request.json());

    if (body.honeypot?.trim()) {
      return NextResponse.json({ ok: true });
    }

    const email = body.email.trim().toLowerCase();
    const confirmEmail = body.confirmEmail.trim().toLowerCase();
    if (email !== confirmEmail) {
      return NextResponse.json({ error: "Email addresses do not match." }, { status: 400 });
    }

    const practiceResult = await deletePracticeDataForEmail(prisma, email);

    const companySessionCount = await prisma.interviewSession.count({
      where: {
        sessionType: "COMPANY",
        candidateEmail: email,
        dataAnonymizedAt: null,
      },
    });

    let status: "PROCESSED" | "PENDING" = "PROCESSED";
    let resultNote = `Practice sessions purged: ${practiceResult.sessionsProcessed}.`;

    if (companySessionCount > 0) {
      status = "PENDING";
      resultNote += ` Company interview data (${companySessionCount} session(s)) requires employer review — request logged.`;
    }

    await prisma.dataDeletionRequest.create({
      data: {
        email,
        reason: body.reason?.trim() || null,
        status,
        clientIp,
        processedAt: status === "PROCESSED" ? new Date() : null,
        resultNote,
      },
    });

    await writePlatformAuditLog(prisma, {
      level: "INFO",
      category: "PRIVACY",
      title: "Data deletion request",
      message: `${email}: ${resultNote}`,
      actor: email,
      metadata: { clientIp, companySessionsPending: String(companySessionCount) },
    });

    return NextResponse.json({
      ok: true,
      practiceSessionsRemoved: practiceResult.sessionsProcessed,
      companySessionsPending: companySessionCount,
      message:
        companySessionCount > 0
          ? "Your practice data was removed. Company interview records are held by the hiring company — we logged your request for follow-up."
          : "Your practice interview data has been removed from our systems.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to process deletion request." }, { status: 500 });
  }
}
