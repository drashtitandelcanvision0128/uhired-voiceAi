import { env } from "@/lib/env";

type RateLimitEntry = { count: number; resetAt: number };

const stores = new Map<string, Map<string, RateLimitEntry>>();

type RedisLike = {
  incr: (key: string) => Promise<number>;
  pExpire: (key: string, ms: number) => Promise<boolean>;
  pTTL: (key: string) => Promise<number>;
  connect: () => Promise<unknown>;
  on: (event: string, listener: () => void) => void;
};

let redisClient: RedisLike | null | undefined;

async function getRedisClient(): Promise<RedisLike | null> {
  if (redisClient !== undefined) return redisClient;
  if (!env.redisUrl) {
    redisClient = null;
    return null;
  }
  try {
    const { createClient } = await import("redis");
    const client = createClient({ url: env.redisUrl });
    client.on("error", () => {
      // Fall back to in-memory when Redis is unavailable.
    });
    await client.connect();
    redisClient = client;
    return client;
  } catch {
    redisClient = null;
    return null;
  }
}

function getStore(namespace: string) {
  let store = stores.get(namespace);
  if (!store) {
    store = new Map();
    stores.set(namespace, store);
  }
  return store;
}

export function getClientIpFromRequest(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip")?.trim() ?? "unknown";
}

function checkRateLimitMemory(
  namespace: string,
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec?: number } {
  const store = getStore(namespace);
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  store.set(key, entry);
  return { allowed: true };
}

async function checkRateLimitRedis(
  namespace: string,
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterSec?: number } | null> {
  const client = await getRedisClient();
  if (!client) return null;

  const redisKey = `rate:${namespace}:${key}`;
  const count = await client.incr(redisKey);
  if (count === 1) {
    await client.pExpire(redisKey, windowMs);
    return { allowed: true };
  }
  const ttlMs = await client.pTTL(redisKey);
  if (count > maxRequests) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil(ttlMs / 1000)),
    };
  }
  return { allowed: true };
}

export function checkRateLimit(
  namespace: string,
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec?: number } {
  return checkRateLimitMemory(namespace, key, maxRequests, windowMs);
}

export async function checkRateLimitAsync(
  namespace: string,
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterSec?: number }> {
  if (env.redisUrl) {
    const redisResult = await checkRateLimitRedis(namespace, key, maxRequests, windowMs);
    if (redisResult) return redisResult;
  }
  return checkRateLimitMemory(namespace, key, maxRequests, windowMs);
}

export function rateLimitResponse(retryAfterSec?: number) {
  return {
    error: "Too many requests. Please try again later.",
    retryAfterSec,
  };
}
