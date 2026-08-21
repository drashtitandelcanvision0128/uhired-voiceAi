import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness probe for Coolify / load balancers.
 * Boot errors (missing production env, etc.) are returned as JSON so deploys are diagnosable.
 */
export async function GET() {
  const started = Date.now();
  try {
    const { env } = await import("@/lib/env");
    const { prisma } = await import("@/lib/prisma");

    let database: "ok" | "error" = "ok";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = "error";
    }

    const body = {
      ok: database === "ok",
      service: "uhired",
      appEnv: env.appEnv,
      database,
      buildId:
        process.env.GIT_COMMIT?.trim() ||
        process.env.SOURCE_COMMIT?.trim() ||
        process.env.COOLIFY_HASH?.trim() ||
        process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
        "unknown",
      nodeEnv: env.nodeEnv,
      latencyMs: Date.now() - started,
      ts: new Date().toISOString(),
    };

    return NextResponse.json(body, { status: database === "ok" ? 200 : 503 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "boot_failed";
    return NextResponse.json(
      {
        ok: false,
        service: "uhired",
        database: "error",
        error: message,
        latencyMs: Date.now() - started,
        ts: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
