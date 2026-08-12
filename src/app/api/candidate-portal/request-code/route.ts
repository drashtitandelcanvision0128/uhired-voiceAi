import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  generatePortalOtpCode,
  hashPortalOtpCode,
  setCandidatePortalSessionCookie,
} from "@/lib/candidate-portal-auth";
import { checkRateLimitAsync, rateLimitResponse } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().trim().email(),
});

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const limited = await checkRateLimitAsync("candidate-portal-otp", ip, 5, 60 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json(rateLimitResponse(limited.retryAfterSec), { status: 429 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    const email = body.email.toLowerCase();
    const code = generatePortalOtpCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.candidatePortalOtp.create({
      data: {
        email,
        codeHash: hashPortalOtpCode(code),
        expiresAt,
      },
    });

    const { sendCandidatePortalOtpEmail } = await import("@/lib/email");
    await sendCandidatePortalOtpEmail({ to: email, code });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid email." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Unable to send login code." }, { status: 500 });
  }
}
