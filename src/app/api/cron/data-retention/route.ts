import { NextResponse } from "next/server";
import { runDataRetentionCleanup } from "@/lib/data-retention";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET?.trim() || "";
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server." },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization")?.trim() ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const headerSecret = request.headers.get("x-cron-secret")?.trim() ?? "";
  const provided = bearer || headerSecret;
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await runDataRetentionCleanup(prisma);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/data-retention]", error);
    return NextResponse.json({ error: "Unable to run data retention cleanup." }, { status: 500 });
  }
}
