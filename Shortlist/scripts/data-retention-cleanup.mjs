/**
 * Scheduled data retention cleanup.
 * Usage: node scripts/data-retention-cleanup.mjs
 */
import { PrismaClient } from "@prisma/client";
import { runDataRetentionCleanup } from "../src/lib/data-retention.ts";

const prisma = new PrismaClient();

try {
  const result = await runDataRetentionCleanup(prisma);
  console.log("Data retention cleanup complete:", result);
} finally {
  await prisma.$disconnect();
}
