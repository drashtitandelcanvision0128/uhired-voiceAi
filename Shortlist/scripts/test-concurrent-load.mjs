/**
 * Simulates concurrent interview API DB load (parallel session reads).
 * Usage: npm run test:load
 */
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "../src/lib/database-url.ts";
import { withPrismaRetry, isPrismaPoolTimeout } from "../src/lib/prisma-retry.ts";

const CONCURRENT = Number(process.env.LOAD_TEST_CONCURRENT ?? "30");
const prisma = new PrismaClient({
  datasources: {
    db: { url: resolveDatabaseUrl(process.env.DATABASE_URL) },
  },
});

async function simulateInterviewStart(sessionId) {
  return withPrismaRetry(async () => {
    const session = await prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, durationMin: true, sessionType: true },
    });
    if (!session) throw new Error("missing session");
    await prisma.interviewSession.update({
      where: { id: sessionId },
      data: { status: session.status === "COMPLETED" ? "COMPLETED" : session.status },
    });
    return session.id;
  });
}

async function main() {
  const sample = await prisma.interviewSession.findFirst({
    where: { sessionType: "PRACTICE" },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (!sample) {
    console.log("⊘ skip load test — no practice session in DB");
    return;
  }

  console.log(`Running ${CONCURRENT} parallel interview DB ops…`);
  const started = Date.now();
  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENT }, () => simulateInterviewStart(sample.id)),
  );
  const elapsed = Date.now() - started;

  const ok = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected");
  const poolErrors = failed.filter(
    (r) => r.status === "rejected" && isPrismaPoolTimeout(r.reason),
  ).length;

  console.log(`Done in ${elapsed}ms — ok=${ok}, failed=${failed.length}, pool_timeouts=${poolErrors}`);
  assert.equal(poolErrors, 0, `Prisma pool timeouts under ${CONCURRENT} parallel ops`);
  assert.ok(ok >= CONCURRENT - 2, "too many failures");
  console.log("\nLoad test passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
