/**
 * Supabase examples often use connection_limit=1 for serverless.
 * Long-running containers (Coolify/Docker) need a larger pool or concurrent
 * API routes will hit Prisma P2024 pool timeouts during parallel interviews.
 */
export function resolveDatabaseUrl(rawUrl = process.env.DATABASE_URL): string | undefined {
  if (!rawUrl) return undefined;

  // Vercel/serverless: keep URL as configured (each instance has its own pool).
  if (process.env.VERCEL) return rawUrl;

  try {
    const url = new URL(rawUrl);
    const targetLimit = Number(process.env.DATABASE_CONNECTION_LIMIT ?? "15");
    const poolTimeout = Number(process.env.DATABASE_POOL_TIMEOUT ?? "30");
    const currentLimit = Number.parseInt(url.searchParams.get("connection_limit") ?? "", 10);

    const shouldRaise =
      !Number.isFinite(currentLimit) || currentLimit < Math.min(targetLimit, 10);

    if (shouldRaise) {
      url.searchParams.set("connection_limit", String(targetLimit));
      console.log(
        `[database] Set Prisma connection_limit to ${targetLimit} for container runtime (${Number.isFinite(currentLimit) ? `was ${currentLimit}` : "unset"}).`,
      );
    }

    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", String(poolTimeout));
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}
