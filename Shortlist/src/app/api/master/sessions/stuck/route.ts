import { NextResponse } from "next/server";
import { z } from "zod";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import {
  deleteMasterStuckSession,
  parseStuckSessionFiltersFromUrl,
  buildStuckSessionWhere,
} from "@/lib/master-stuck-sessions";
import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const { searchParams } = url;
    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
    );

    const filters = parseStuckSessionFiltersFromUrl(url);
    const where = buildStuckSessionWhere(filters);

    const [stuckCount, liveCount, stuckSessions] = await Promise.all([
      prisma.interviewSession.count({ where }),
      prisma.interviewSession.count({ where: { status: "LIVE" } }),
      prisma.interviewSession.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          sessionType: true,
          candidateName: true,
          candidateEmail: true,
          companyName: true,
          domain: true,
          status: true,
          createdAt: true,
          startedAt: true,
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(stuckCount / pageSize));

    return NextResponse.json({
      liveCount,
      stuckCount,
      pagination: {
        page,
        pageSize,
        total: stuckCount,
        totalPages,
      },
      sessions: stuckSessions.map((session) => ({
        id: session.id,
        type: session.sessionType,
        name: session.candidateName ?? session.companyName ?? "Unknown",
        email: session.candidateEmail ?? "",
        domain: session.domain,
        status: session.status,
        createdAt: session.createdAt.toISOString(),
        startedAt: session.startedAt?.toISOString() ?? null,
        ageHours: Math.round((Date.now() - session.createdAt.getTime()) / (1000 * 60 * 60)),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Unable to load stuck sessions." }, { status: 500 });
  }
}

const bulkDeleteSchema = z.object({
  sessionIds: z.array(z.string().min(1)).min(1).max(50),
});

export async function DELETE(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = bulkDeleteSchema.parse(await request.json());
    let deletedCount = 0;

    for (const sessionId of body.sessionIds) {
      const result = await deleteMasterStuckSession(prisma, sessionId);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, deletedCount },
          { status: result.error === "Stuck session not found." ? 404 : 500 },
        );
      }
      deletedCount += 1;
    }

    return NextResponse.json({ ok: true, deletedCount });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to delete stuck sessions." }, { status: 500 });
  }
}
