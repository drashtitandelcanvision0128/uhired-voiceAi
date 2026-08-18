import { NextResponse } from "next/server";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { listMasterLoginEvents } from "@/lib/master-login-audit";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "10") || 10));
    const filter = url.searchParams.get("filter")?.trim().toLowerCase();
    const search = url.searchParams.get("search")?.trim() ?? "";
    const trust = url.searchParams.get("trust")?.trim().toLowerCase();

    const successFilter =
      filter === "success" ? true : filter === "failed" ? false : undefined;
    const trustDevice =
      trust === "yes" ? true : trust === "no" ? false : undefined;

    const { rows, total } = await listMasterLoginEvents(prisma, {
      page,
      pageSize,
      success: successFilter,
      search,
      trustDevice,
    });

    const [allEvents, successEvents, failedEvents] = await Promise.all([
      listMasterLoginEvents(prisma, { page: 1, pageSize: 1 }).then((r) => r.total),
      listMasterLoginEvents(prisma, { page: 1, pageSize: 1, success: true }).then((r) => r.total),
      listMasterLoginEvents(prisma, { page: 1, pageSize: 1, success: false }).then((r) => r.total),
    ]);

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentFailed24h = (
      await listMasterLoginEvents(prisma, { page: 1, pageSize: 200, success: false })
    ).rows.filter((row) => new Date(row.createdAt) >= oneDayAgo).length;

    return NextResponse.json({
      summary: {
        totalEvents: allEvents,
        successfulLogins: successEvents,
        failedLogins: failedEvents,
        recentFailed24h,
      },
      events: rows.map((event) => ({
        id: event.id,
        email: event.email,
        success: event.success,
        clientIp: event.clientIp,
        userAgent: event.userAgent,
        trustDevice: event.trustDevice,
        createdAt: event.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load security log." }, { status: 500 });
  }
}
