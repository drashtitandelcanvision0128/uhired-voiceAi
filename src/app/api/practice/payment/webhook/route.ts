import crypto from "crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const secret = env.razorpayWebhookSecret;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured." }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const digest = crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (digest !== signature) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const parsed = payload as {
    event?: string;
    payload?: { payment?: { entity?: { order_id?: string; id?: string } } };
  };
  const event = parsed.event;
  const orderId = parsed.payload?.payment?.entity?.order_id;
  const paymentId = parsed.payload?.payment?.entity?.id;
  if (!event || !orderId) {
    return NextResponse.json({ ok: true });
  }

  if (event === "payment.captured") {
    await prisma.practicePayment.updateMany({
      where: { orderId },
      data: { status: "VERIFIED", paymentId: paymentId ?? undefined },
    });
  } else if (event === "payment.failed") {
    await prisma.practicePayment.updateMany({
      where: { orderId },
      data: { status: "FAILED", paymentId: paymentId ?? undefined },
    });
  }

  return NextResponse.json({ ok: true });
}
