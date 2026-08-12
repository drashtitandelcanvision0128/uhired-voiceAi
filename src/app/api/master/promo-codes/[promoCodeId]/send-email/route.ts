import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { sendPromoCodeNotificationEmail } from "@/lib/promo-code-email.server";

type Context = {
  params: Promise<{ promoCodeId: string }>;
};

export async function POST(request: Request, context: Context) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { promoCodeId } = await context.params;
  const promo = await prisma.promoCode.findUnique({ where: { id: promoCodeId } });
  if (!promo) {
    return NextResponse.json({ error: "Promo code not found." }, { status: 404 });
  }

  if (!promo.recipientEmail) {
    return NextResponse.json(
      { error: "This promo code is not assigned to a specific user. Add a recipient email first." },
      { status: 400 },
    );
  }

  const emailResult = await sendPromoCodeNotificationEmail(request, {
    code: promo.code,
    durationMin: promo.durationMin,
    recipientEmail: promo.recipientEmail,
    companyName: promo.companyName,
  });

  if (!emailResult.sent) {
    return NextResponse.json(
      { error: emailResult.error ?? "Unable to send promo code email." },
      { status: 500 },
    );
  }

  await prisma.promoCode.update({
    where: { id: promo.id },
    data: { emailSentAt: new Date() },
  });

  return NextResponse.json({ ok: true, email: emailResult });
}
