import { NextResponse } from "next/server";
import { z } from "zod";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { prisma } from "@/lib/prisma";
import { writePlatformAuditLog } from "@/lib/platform-audit-log";

type Context = {
  params: Promise<{ paymentId: string }>;
};

const patchSchema = z.object({
  action: z.enum(["verify", "mark_failed", "refund", "retry"]),
});

export async function PATCH(request: Request, context: Context) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { paymentId } = await context.params;
    const body = patchSchema.parse(await request.json());

    const payment = await prisma.practicePayment.findUnique({
      where: { id: paymentId },
      include: { session: { select: { id: true } } },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    let nextStatus = payment.status;
    let logTitle = "";
    let logMessage = "";

    switch (body.action) {
      case "verify":
        if (payment.status === "VERIFIED") {
          return NextResponse.json({ error: "Payment is already verified." }, { status: 400 });
        }
        nextStatus = "VERIFIED";
        logTitle = "Payment manually verified";
        logMessage = `Master admin verified payment ${payment.orderId} for ${payment.candidateEmail}.`;
        if (payment.sessionId) {
          await prisma.interviewSession.update({
            where: { id: payment.sessionId },
            data: { isPaid: true },
          });
        }
        break;
      case "mark_failed":
        nextStatus = "FAILED";
        logTitle = "Payment marked failed";
        logMessage = `Master admin marked payment ${payment.orderId} as failed.`;
        break;
      case "refund":
        if (payment.status !== "VERIFIED") {
          return NextResponse.json({ error: "Only verified payments can be refunded." }, { status: 400 });
        }
        nextStatus = "REFUNDED";
        logTitle = "Payment refunded";
        logMessage = `Master admin refunded payment ${payment.orderId} (₹${(payment.amountPaise / 100).toFixed(0)}).`;
        break;
      case "retry":
        if (payment.status !== "FAILED") {
          return NextResponse.json({ error: "Only failed payments can be retried." }, { status: 400 });
        }
        nextStatus = "CREATED";
        logTitle = "Payment reset for retry";
        logMessage = `Master admin reset payment ${payment.orderId} to pending for retry.`;
        break;
    }

    const updated = await prisma.practicePayment.update({
      where: { id: paymentId },
      data: { status: nextStatus },
    });

    await writePlatformAuditLog(prisma, {
      level: body.action === "mark_failed" ? "ERROR" : body.action === "refund" ? "WARNING" : "SUCCESS",
      category: "PAYMENT",
      title: logTitle,
      message: logMessage,
      metadata: {
        paymentId: payment.id,
        orderId: payment.orderId,
        status: nextStatus,
        action: body.action,
      },
    });

    return NextResponse.json({
      ok: true,
      payment: {
        id: updated.id,
        status: updated.status,
        orderId: updated.orderId,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update payment." }, { status: 500 });
  }
}
