import { NextResponse } from "next/server";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim().toUpperCase() ?? "PENDING";
  const where =
    status === "ALL"
      ? {}
      : status === "PROCESSED" || status === "REJECTED" || status === "PENDING"
        ? { status: status as "PENDING" | "PROCESSED" | "REJECTED" }
        : { status: "PENDING" as const };

  const requests = await prisma.dataDeletionRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    requests: requests.map((row) => ({
      id: row.id,
      email: row.email,
      reason: row.reason,
      status: row.status,
      resultNote: row.resultNote,
      clientIp: row.clientIp,
      createdAt: row.createdAt.toISOString(),
      processedAt: row.processedAt?.toISOString() ?? null,
    })),
  });
}
