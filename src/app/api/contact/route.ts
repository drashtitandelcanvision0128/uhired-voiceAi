import { NextResponse } from "next/server";
import { z } from "zod";
import {
  checkRateLimitAsync,
  getClientIpFromRequest,
  rateLimitResponse,
} from "@/lib/rate-limit";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email("Valid email is required."),
  subject: z.string().trim().min(1, "Subject is required."),
  message: z.string().trim().min(1, "Message is required."),
  honeypot: z.string().optional(),
  source: z.enum(["PUBLIC_CONTACT", "COMPANY_ADMIN"]).optional(),
});

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const clientIp = getClientIpFromRequest(request);
    const rate = await checkRateLimitAsync("contact", clientIp, RATE_LIMIT, RATE_WINDOW_MS);
    if (!rate.allowed) {
      return NextResponse.json(rateLimitResponse(rate.retryAfterSec), { status: 429 });
    }

    const body = await request.json();
    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    if (parsed.data.honeypot) {
      return NextResponse.json({ ok: true });
    }

    const { prisma } = await import("@/lib/prisma");
    const { createSupportInquiry } = await import("@/lib/support-inquiry-db");

    await createSupportInquiry(prisma, {
      name: parsed.data.name,
      email: parsed.data.email,
      subject: parsed.data.subject,
      message: parsed.data.message,
      source: parsed.data.source ?? "PUBLIC_CONTACT",
      clientIp,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Unable to process your request." },
      { status: 500 },
    );
  }
}
