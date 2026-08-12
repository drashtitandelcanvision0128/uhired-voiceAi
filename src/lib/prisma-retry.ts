import { Prisma } from "@prisma/client";

const POOL_TIMEOUT_CODES = new Set(["P2024", "P2037"]);

export function isPrismaPoolTimeout(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return POOL_TIMEOUT_CODES.has(error.code);
  }
  const message = error instanceof Error ? error.message : String(error);
  return /timed out fetching a new connection|connection pool/i.test(message);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry transient Prisma pool timeouts during concurrent interview load.
 */
export async function withPrismaRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !isPrismaPoolTimeout(error)) {
        throw error;
      }
      attempt += 1;
      await sleep(75 * attempt);
    }
  }
}
