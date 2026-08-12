import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashRawScorecardShareToken } from "@/lib/scorecard-share-token";

type Context = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, context: Context) {
  const { token } = await context.params;
  const tokenHash = await hashRawScorecardShareToken(token);

  const link = await prisma.interviewObserverLink.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      session: {
        select: {
          id: true,
          status: true,
          candidateName: true,
          domain: true,
          topic: true,
          positionTitle: true,
          companyName: true,
          durationMin: true,
          startedAt: true,
          transcript: {
            orderBy: { orderIndex: "asc" },
            select: {
              speaker: true,
              message: true,
              orderIndex: true,
              timestampMs: true,
            },
          },
        },
      },
    },
  });

  if (!link) {
    return NextResponse.json({ error: "Observer link invalid or expired." }, { status: 404 });
  }

  return NextResponse.json({
    session: link.session,
    expiresAt: link.expiresAt.toISOString(),
  });
}
