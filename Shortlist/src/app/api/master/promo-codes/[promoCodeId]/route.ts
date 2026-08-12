import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { normalizeEmail } from "@/lib/parse-candidate-emails";

const updatePromoSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, dash, or underscore only.")
      .optional(),
    durationMin: z.coerce.number().int().min(10).max(120).optional(),
    isActive: z.boolean().optional(),
    recipientEmail: z.string().trim().email().optional().or(z.literal("")).nullable(),
    companyName: z.string().trim().max(120).optional().or(z.literal("")).nullable(),
  })
  .refine(
    (body) =>
      body.code !== undefined ||
      body.durationMin !== undefined ||
      body.isActive !== undefined ||
      body.recipientEmail !== undefined ||
      body.companyName !== undefined,
    {
      message: "Provide at least one field to update.",
    },
  )
  .superRefine((body, ctx) => {
    if (body.recipientEmail === undefined && body.companyName === undefined) return;
    const email = body.recipientEmail?.trim() ?? "";
    const company = body.companyName?.trim() ?? "";
    if (email && !company) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Company name is required when assigning a promo code to a user.",
        path: ["companyName"],
      });
    }
  });

type Context = {
  params: Promise<{ promoCodeId: string }>;
};

export async function PATCH(request: Request, context: Context) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { promoCodeId } = await context.params;
    const body = updatePromoSchema.parse(await request.json());
    const existing = await prisma.promoCode.findUnique({ where: { id: promoCodeId } });
    if (!existing) {
      return NextResponse.json({ error: "Promo code not found." }, { status: 404 });
    }

    const updated = await prisma.promoCode.update({
      where: { id: promoCodeId },
      data: {
        ...(body.code !== undefined ? { code: body.code.trim().toUpperCase() } : {}),
        ...(body.durationMin !== undefined ? { durationMin: body.durationMin } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.recipientEmail !== undefined
          ? {
              recipientEmail: body.recipientEmail?.trim()
                ? normalizeEmail(body.recipientEmail)
                : null,
            }
          : {}),
        ...(body.companyName !== undefined
          ? { companyName: body.companyName?.trim() || null }
          : {}),
      },
    });

    return NextResponse.json({ ok: true, promoCode: updated });
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
    return NextResponse.json({ error: "Unable to update promo code." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { promoCodeId } = await context.params;
  const existing = await prisma.promoCode.findUnique({ where: { id: promoCodeId } });
  if (!existing) {
    return NextResponse.json({ error: "Promo code not found." }, { status: 404 });
  }

  await prisma.promoCode.delete({ where: { id: promoCodeId } });
  return NextResponse.json({ ok: true });
}
