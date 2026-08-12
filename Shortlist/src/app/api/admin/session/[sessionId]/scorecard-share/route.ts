import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCompanyAdminSessionFromCookieHeader } from "@/lib/company-admin-auth";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import { generateRawScorecardShareToken, hashRawScorecardShareToken } from "@/lib/scorecard-share-token";

type Context = {
  params: Promise<{ sessionId: string }>;
};

const postBodySchema = z.object({
  ttlDays: z.coerce.number().int().min(1).max(90).optional().default(14),
  includeCandidateName: z.boolean().optional().default(true),
});

export async function GET(request: Request, context: Context) {
  const { sessionId } = await context.params;
  const auth = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, companyId: auth.companyId },
    select: { id: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const links = await prisma.scorecardShareLink.findMany({
    where: {
      sessionId,
      companyId: auth.companyId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      expiresAt: true,
      createdAt: true,
      includeCandidateName: true,
    },
  });

  return NextResponse.json({ links });
}

export async function POST(request: Request, context: Context) {
  const { sessionId } = await context.params;
  const auth = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof postBodySchema>;
  try {
    const raw = await request.json().catch(() => ({}));
    body = postBodySchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const session = await prisma.interviewSession.findFirst({
    where: {
      id: sessionId,
      companyId: auth.companyId,
      sessionType: "COMPANY",
    },
    include: { scorecard: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  if (!session.scorecard) {
    return NextResponse.json({ error: "No scorecard for this session yet." }, { status: 409 });
  }

  const expiresAt = new Date(Date.now() + body.ttlDays * 86_400_000);
  const existing = await prisma.scorecardShareLink.findFirst({
    where: {
      sessionId: session.id,
      companyId: auth.companyId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    const link = await prisma.scorecardShareLink.update({
      where: { id: existing.id },
      data: {
        expiresAt,
        includeCandidateName: body.includeCandidateName,
      },
    });
    return NextResponse.json({
      reused: true,
      linkId: link.id,
      expiresAt: link.expiresAt.toISOString(),
      includeCandidateName: link.includeCandidateName,
      message:
        "An active share link already exists for this session. Use the link you saved earlier, or revoke it to create a new URL.",
    });
  }

  const rawToken = generateRawScorecardShareToken();
  const tokenHash = await hashRawScorecardShareToken(rawToken);
  const link = await prisma.scorecardShareLink.create({
    data: {
      tokenHash,
      sessionId: session.id,
      companyId: auth.companyId,
      expiresAt,
      includeCandidateName: body.includeCandidateName,
    },
  });

  const base = getPublicAppBaseUrl(request);
  const shareUrl = `${base}/share/scorecard/${rawToken}`;
  const pdfUrl = `${base}/api/share/scorecard/${encodeURIComponent(rawToken)}/pdf`;

  return NextResponse.json({
    reused: false,
    shareUrl,
    pdfUrl,
    linkId: link.id,
    expiresAt: expiresAt.toISOString(),
    includeCandidateName: link.includeCandidateName,
  });
}
