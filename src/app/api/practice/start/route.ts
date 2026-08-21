import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateAccessCode } from "@/lib/codes";
import { resolveMandatoryQuestionsForRequirement } from "@/lib/resolve-requirement-questions";

const schema = z
  .object({
    candidateName: z.string().trim().min(1),
    email: z.string().trim().email(),
    domain: z.string().trim().min(1),
    topic: z.string().trim().min(1),
    durationMin: z.coerce.number().min(3).max(120),
    promoCode: z.string().trim().optional(),
    paymentOrderId: z.string().trim().optional(),
    preview: z.boolean().optional(),
  })
  .superRefine((body, ctx) => {
    if (body.preview) {
      if (body.durationMin !== 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Preview sessions are limited to 3 minutes.",
          path: ["durationMin"],
        });
      }
      if (body.promoCode || body.paymentOrderId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Preview sessions cannot include promo codes or payment details.",
          path: ["preview"],
        });
      }
      return;
    }

    if (body.durationMin < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Paid practice sessions require at least 10 minutes.",
        path: ["durationMin"],
      });
    }
  });

class PaymentAlreadyClaimedError extends Error {
  constructor() {
    super("PAYMENT_ALREADY_CLAIMED");
    this.name = "PaymentAlreadyClaimedError";
  }
}

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    let isPaid = false;
    let appliedPromo: string | null = null;
    const normalizedPromo = body.promoCode?.trim().toUpperCase() ?? "";
    const normalizedEmail = body.email.trim().toLowerCase();

    if (body.preview) {
      const recentPreview = await prisma.interviewSession.findFirst({
        where: {
          sessionType: "PRACTICE",
          candidateEmail: normalizedEmail,
          promoCode: "PREVIEW",
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (recentPreview) {
        return NextResponse.json(
          { error: "You've already used your free preview today. Come back tomorrow or book a full session." },
          { status: 429 },
        );
      }
      isPaid = true;
      appliedPromo = "PREVIEW";
    } else if (normalizedPromo) {
      const promo = await prisma.promoCode.findUnique({
        where: { code: normalizedPromo },
      });
      if (promo?.isActive) {
        if (promo.durationMin !== body.durationMin) {
          return NextResponse.json(
            {
              error: `Promo code is valid only for ${promo.durationMin} minute practice sessions.`,
            },
            { status: 400 },
          );
        }
        if (promo.recipientEmail && promo.recipientEmail.toLowerCase() !== normalizedEmail) {
          return NextResponse.json(
            { error: "This promo code is assigned to a different email address." },
            { status: 400 },
          );
        }
        isPaid = true;
        appliedPromo = promo.code;
      } else {
        return NextResponse.json({ error: "Invalid promo code." }, { status: 400 });
      }
    }

    let verifiedPaymentId: string | null = null;
    if (!isPaid && body.paymentOrderId) {
      const payment = await prisma.practicePayment.findUnique({
        where: { orderId: body.paymentOrderId },
      });
      if (
        payment &&
        payment.status === "VERIFIED" &&
        payment.candidateEmail.toLowerCase() === normalizedEmail &&
        !payment.sessionId
      ) {
        isPaid = true;
        verifiedPaymentId = payment.id;
      }
    }

    if (!isPaid) {
      return NextResponse.json(
        { error: "Apply a valid promo code or complete payment to continue." },
        { status: 400 },
      );
    }

    const tailoredQuestions = await resolveMandatoryQuestionsForRequirement({
      manualMandatory: [],
      positionTitle: body.domain,
      jobDescription: `${body.domain}\n\n${body.topic}`,
      domain: body.domain,
      topic: body.topic,
      keySkills: [],
      durationMin: body.durationMin,
    });

    const session = await prisma.$transaction(async (tx) => {
      const created = await tx.interviewSession.create({
        data: {
          accessCode: generateAccessCode("PRC"),
          sessionType: "PRACTICE",
          candidateName: body.candidateName,
          candidateEmail: normalizedEmail,
          domain: body.domain,
          topic: body.topic,
          durationMin: body.durationMin,
          isPaid,
          promoCode: appliedPromo,
          questions: {
            create: tailoredQuestions.map((question, index) => ({
              prompt: question.prompt,
              expectedAnswer: question.expectedAnswer,
              gradingRubric: question.gradingRubric,
              difficulty: question.difficulty,
              orderIndex: index,
              isMandatory: true,
            })),
          },
        },
      });

      if (verifiedPaymentId) {
        // Atomic claim: only one concurrent start can attach this verified payment.
        const claimed = await tx.practicePayment.updateMany({
          where: {
            id: verifiedPaymentId,
            status: "VERIFIED",
            sessionId: null,
          },
          data: { sessionId: created.id },
        });
        if (claimed.count === 0) {
          throw new PaymentAlreadyClaimedError();
        }
      }

      return created;
    });

    return NextResponse.json({ sessionId: session.id, accessCode: session.accessCode });
  } catch (error) {
    if (error instanceof PaymentAlreadyClaimedError) {
      return NextResponse.json(
        { error: "This payment was already used to start an interview." },
        { status: 409 },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create practice session." }, { status: 500 });
  }
}
