import { NextResponse } from "next/server";
import { abandonStuckLiveSessions } from "@/lib/master-stuck-sessions";
import { prisma } from "@/lib/prisma";

/**
 * Cron / scheduler endpoint: auto-abandon stuck LIVE interviews.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>  OR  x-cron-secret: <CRON_SECRET>
 * Coolify / external cron can hit this every 15–30 minutes.
 */
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
    const result = await abandonStuckLiveSessions(prisma, {
      limit: 100,
      actor: "cron",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/abandon-stuck-sessions]", error);
    return NextResponse.json({ error: "Unable to abandon stuck sessions." }, { status: 500 });
  }
}
