/**
 * Baseline Prisma migrations on a DB that already has tables/data
 * (fixes P3005: "database schema is not empty").
 *
 * Usage: npm run db:baseline
 */
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "prisma", "migrations");

const names = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

console.log(`Baselining ${names.length} migrations (mark as already applied)...\n`);

const prismaBin =
  process.env.PRISMA_BIN ||
  (process.platform === "win32"
    ? "npx prisma"
    : "/prisma-tools/node_modules/.bin/prisma");

for (const name of names) {
  process.stdout.write(`  ${name}... `);
  try {
    execSync(`${prismaBin} migrate resolve --applied ${name} --schema=./prisma/schema.prisma`, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    console.log("ok");
  } catch (err) {
    const msg = err.stderr?.toString() || err.message;
    if (msg.includes("already recorded as applied")) {
      console.log("already applied");
    } else {
      console.log("failed");
      console.error(msg);
      process.exit(1);
    }
  }
}

console.log("\nDone. Run: npm run db:migrate:status");
