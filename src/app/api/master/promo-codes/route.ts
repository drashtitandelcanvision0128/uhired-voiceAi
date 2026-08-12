import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { normalizeEmail } from "@/lib/parse-candidate-emails";
import { sendPromoCodeNotificationEmail } from "@/lib/promo-code-email.server";

const createPromoSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, dash, or underscore only."),
    durationMin: z.coerce.number().int().min(10).max(120),
    recipientEmail: z.string().trim().email().optional().or(z.literal("")),
    companyName: z.string().trim().max(120).optional().or(z.literal("")),
    sendEmail: z.boolean().optional(),
  })
  .superRefine((body, ctx) => {
    const email = body.recipientEmail?.trim();
    const company = body.companyName?.trim();
    if (email && !company) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Company name is required when assigning a promo code to a user.",
        path: ["companyName"],
      });
    }
  });

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const promoCodes = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
  });

  const usageByCode = await prisma.interviewSession.groupBy({
    by: ["promoCode"],
    where: {
      sessionType: "PRACTICE",
      promoCode: { not: null },
    },
    _count: { _all: true },
  });

  const usageMap = new Map(
    usageByCode
      .filter((entry) => entry.promoCode)
      .map((entry) => [entry.promoCode as string, entry._count._all]),
  );

  return NextResponse.json({
    promoCodes: promoCodes.map((promo) => ({
      ...promo,
      usageCount: usageMap.get(promo.code) ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = createPromoSchema.parse(await request.json());
    const normalizedCode = body.code.trim().toUpperCase();
    const recipientEmail = body.recipientEmail?.trim()
      ? normalizeEmail(body.recipientEmail)
      : null;
    const companyName = body.companyName?.trim() || null;
    const shouldSendEmail = body.sendEmail ?? Boolean(recipientEmail);

    const created = await prisma.promoCode.create({
      data: {
        code: normalizedCode,
        durationMin: body.durationMin,
        isActive: true,
        recipientEmail,
        companyName,
      },
    });

    let emailResult: { sent: boolean; error?: string } | null = null;
    if (shouldSendEmail && recipientEmail) {
      emailResult = await sendPromoCodeNotificationEmail(request, {
        code: created.code,
        durationMin: created.durationMin,
        recipientEmail,
        companyName,
      });
      if (emailResult.sent) {
        await prisma.promoCode.update({
          where: { id: created.id },
          data: { emailSentAt: new Date() },
        });
        created.emailSentAt = new Date();
      }
    }

    return NextResponse.json({
      ok: true,
      promoCode: created,
      email: emailResult,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "Promo code already exists." }, { status: 409 });
    }

    console.error("[promo-codes] create failed:", error);
    const message =
      error instanceof Error && process.env.NODE_ENV === "development"
        ? error.message
        : "Unable to create promo code.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}