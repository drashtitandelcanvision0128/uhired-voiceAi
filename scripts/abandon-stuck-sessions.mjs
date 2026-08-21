/**
 * Abandon stuck LIVE interview sessions (status → FAILED).
 * Usage: node --env-file=.env scripts/abandon-stuck-sessions.mjs
 */
import { PrismaClient } from "@prisma/client";

const STUCK_SESSION_AGE_MS = 60 * 60 * 1000;

const prisma = new PrismaClient();

async function main() {
  const cutoff = new Date(Date.now() - STUCK_SESSION_AGE_MS);
  const candidates = await prisma.interviewSession.findMany({
    where: {
      status: "LIVE",
      OR: [{ startedAt: { lt: cutoff } }, { startedAt: null, updatedAt: { lt: cutoff } }],
    },
    orderBy: [{ startedAt: "asc" }, { updatedAt: "asc" }],
    take: 100,
    select: { id: true, candidateEmail: true, startedAt: true },
  });

  if (candidates.length === 0) {
    console.log("No stuck LIVE sessions to abandon.");
    return;
  }

  const ids = candidates.map((s) => s.id);
  const result = await prisma.interviewSession.updateMany({
    where: { id: { in: ids }, status: "LIVE" },
    data: { status: "FAILED", endedAt: new Date() },
  });

  console.log(`Abandoned ${result.count} stuck LIVE session(s):`);
  for (const session of candidates) {
    console.log(` - ${session.id} (${session.candidateEmail ?? "no-email"}) startedAt=${session.startedAt?.toISOString() ?? "null"}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
