import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Lightweight version endpoint for FE/BE drift checks. */
export async function GET() {
  try {
    const { env } = await import("@/lib/env");
    return NextResponse.json({
      service: "uhired",
      appEnv: env.appEnv,
      buildId:
        process.env.GIT_COMMIT?.trim() ||
        process.env.SOURCE_COMMIT?.trim() ||
        process.env.COOLIFY_HASH?.trim() ||
        process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
        "unknown",
      videoStorageProvider: env.videoStorageProvider,
      migrationsOwner: process.env.RUN_MIGRATIONS?.trim() || "true",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "boot_failed";
    return NextResponse.json(
      {
        service: "uhired",
        ok: false,
        error: message,
        buildId:
          process.env.GIT_COMMIT?.trim() ||
          process.env.SOURCE_COMMIT?.trim() ||
          process.env.COOLIFY_HASH?.trim() ||
          process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
          "unknown",
      },
      { status: 503 },
    );
  }
}
