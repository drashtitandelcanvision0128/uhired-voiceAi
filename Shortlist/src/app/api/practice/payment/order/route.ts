import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getRazorpayClient } from "@/lib/razorpay";
import { getPracticeAmountPaise } from "@/lib/pricing";

const schema = z.object({
  candidateName: z.string().trim().min(1),
  email: z.string().trim().email(),
  domain: z.string().trim().min(1),
  topic: z.string().trim().min(1),
  durationMin: z.coerce.number().int().min(10).max(120),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const amountPaise = getPracticeAmountPaise(body.durationMin);

    const razorpay = getRazorpayClient();
    const receipt = `prc_${randomUUID().slice(0, 12)}`;
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        candidateName: body.candidateName,
        email: body.email,
        domain: body.domain,
      },
    });

    await prisma.practicePayment.create({
      data: {
        orderId: order.id,
        amountPaise,
        currency: order.currency,
        status: "CREATED",
        candidateName: body.candidateName,
        candidateEmail: body.email.toLowerCase(),
        domain: body.domain,
        topic: body.topic,
        durationMin: body.durationMin,
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amountPaise,
      currency: order.currency,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create payment order." }, { status: 500 });
  }
}
