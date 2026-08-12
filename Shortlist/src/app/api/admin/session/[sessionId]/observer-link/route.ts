import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCompanyAdminSessionFromCookieHeader } from "@/lib/company-admin-auth";
import { getPublicAppBaseUrl } from "@/lib/public-app-url";
import {
  generateRawScorecardShareToken,
  hashRawScorecardShareToken,
} from "@/lib/scorecard-share-token";

type Context = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(request: Request, context: Context) {
  const { sessionId } = await context.params;
  const auth = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, companyId: auth.companyId, sessionType: "COMPANY" },
    select: { id: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const now = new Date();
  const links = await prisma.interviewObserverLink.findMany({
    where: { sessionId, companyId: auth.companyId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    links: links.map((link) => ({
      id: link.id,
      expiresAt: link.expiresAt.toISOString(),
      revokedAt: link.revokedAt?.toISOString() ?? null,
      createdAt: link.createdAt.toISOString(),
      active: !link.revokedAt && link.expiresAt > now,
    })),
  });
}

const postBodySchema = z.object({
  ttlHours: z.coerce.number().int().min(1).max(72).optional().default(24),
});

export async function POST(request: Request, context: Context) {
  const { sessionId } = await context.params;
  const auth = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof postBodySchema>;
  try {
    body = postBodySchema.parse(await request.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, companyId: auth.companyId, sessionType: "COMPANY" },
    select: { id: true, status: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  if (session.status === "COMPLETED") {
    return NextResponse.json(
      { error: "Observer links are only available for active interviews." },
      { status: 409 },
    );
  }

  const rawToken = generateRawScorecardShareToken();
  const tokenHash = await hashRawScorecardShareToken(rawToken);
  const expiresAt = new Date(Date.now() + body.ttlHours * 60 * 60 * 1000);

  const link = await prisma.interviewObserverLink.create({
    data: {
      sessionId,
      companyId: auth.companyId,
      tokenHash,
      expiresAt,
    },
  });

  const baseUrl = getPublicAppBaseUrl(request);
  return NextResponse.json({
    id: link.id,
    url: `${baseUrl}/observe/${rawToken}`,
    expiresAt: link.expiresAt.toISOString(),
  });
}
