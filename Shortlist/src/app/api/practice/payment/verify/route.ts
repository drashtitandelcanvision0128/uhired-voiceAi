import { NextResponse } from "next/server";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const secret = env.razorpayKeySecret;
    if (!secret) {
      return NextResponse.json({ error: "Razorpay secret is not configured." }, { status: 500 });
    }

    const expected = createHmac("sha256", secret)
      .update(`${body.orderId}|${body.paymentId}`)
      .digest("hex");
    const isValid =
      expected.length === body.signature.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(body.signature));

    if (!isValid) {
      await prisma.practicePayment.updateMany({
        where: { orderId: body.orderId },
        data: { status: "FAILED" },
      });
      return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });
    }

    const payment = await prisma.practicePayment.findUnique({
      where: { orderId: body.orderId },
    });
    if (!payment) {
      return NextResponse.json({ error: "Payment order not found." }, { status: 404 });
    }

    await prisma.practicePayment.update({
      where: { orderId: body.orderId },
      data: {
        status: "VERIFIED",
        paymentId: body.paymentId,
        signature: body.signature,
      },
    });

    return NextResponse.json({ ok: true, orderId: body.orderId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to verify payment." }, { status: 500 });
  }
}
