import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import {
  listPlatformAuditLogs,
  seedPlatformAuditLogsIfEmpty,
  type LogCategory,
  type LogLevel,
} from "@/lib/platform-audit-log";

export type { LogLevel, LogCategory, PlatformLogEntry } from "@/lib/platform-audit-log";

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "10") || 10));
    const category = url.searchParams.get("category")?.trim().toUpperCase() as LogCategory | "" | undefined;
    const level = url.searchParams.get("level")?.trim().toUpperCase() as LogLevel | "" | undefined;
    const search = url.searchParams.get("search")?.trim() ?? "";

    await seedPlatformAuditLogsIfEmpty(prisma);

    const { rows, total, categoryCounts, levelCounts } = await listPlatformAuditLogs(prisma, {
      page,
      pageSize,
      category: category ?? "",
      level: level ?? "",
      search,
    });

    const liveSessions = await prisma.interviewSession.count({ where: { status: "LIVE" } });
    const last24Hours = rows.filter(
      (log) => Date.now() - new Date(log.timestamp).getTime() < 24 * 60 * 60 * 1000,
    ).length;

    return NextResponse.json({
      summary: {
        totalLogs: total,
        last24Hours,
        errors: levelCounts.ERROR ?? 0,
        warnings: levelCounts.WARNING ?? 0,
        liveSessions,
      },
      categoryCounts,
      levelCounts,
      logs: rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load platform logs." }, { status: 500 });
  }
}
