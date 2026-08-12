/**
 * Import live data from sqltables/*.sql into PostgreSQL (merge — keeps existing rows).
 *
 * Usage:
 *   npm run db:import:sqltables
 *
 * Env: uses DIRECT_URL, else DATABASE_URL (same as Prisma).
 * Coolify: open app terminal after deploy, run the same command once.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_DIR = join(__dirname, "..", "sqltables");

/** FK-safe import order */
const TABLE_ORDER = [
  "PromoCode",
  "Company",
  "Requirement",
  "Candidate",
  "RequirementQuestion",
  "InterviewSession",
  "InterviewQuestion",
  "InterviewTurn",
  "Scorecard",
  "PracticePayment",
  "ScorecardShareLink",
  "ScoringBatchJob",
];

const SKIP_FILE_PATTERNS = [
  /^\s*_prisma_migrations/i,
  /\(\s*1\s*\)\.sql$/i,
];

/** Prefer row-by-row for tables that may contain malformed JSON in exports. */
const ROW_BY_ROW_TABLES = new Set(["Scorecard", "ScoringBatchJob"]);

function resolveSqlFiles() {
  if (!existsSync(SQL_DIR)) {
    throw new Error(`sqltables folder not found: ${SQL_DIR}`);
  }

  const files = readdirSync(SQL_DIR).filter((f) => f.endsWith(".sql"));
  const byTable = new Map();

  for (const file of files) {
    if (SKIP_FILE_PATTERNS.some((re) => re.test(file))) {
      console.log(`  skip ${file} (ignored pattern)`);
      continue;
    }

    const match = file.match(/^(.+?)_rows\.sql$/i);
    if (!match) {
      console.log(`  skip ${file} (unrecognized name)`);
      continue;
    }

    const table = match[1];
    if (!byTable.has(table)) {
      byTable.set(table, join(SQL_DIR, file));
    } else {
      console.log(`  skip ${file} (duplicate of ${table})`);
    }
  }

  return TABLE_ORDER.filter((t) => byTable.has(t)).map((t) => ({
    table: t,
    path: byTable.get(t),
  }));
}

function parseInsertStatement(raw) {
  const sql = raw.trim().replace(/;\s*$/, "");
  if (!/^INSERT\s+INTO/i.test(sql)) {
    throw new Error("Expected INSERT statement");
  }

  const valuesIdx = sql.search(/\bVALUES\b/i);
  if (valuesIdx === -1) {
    return { head: sql, rows: [] };
  }

  const head = sql.slice(0, valuesIdx + 6).trimEnd();
  const valuesPart = sql.slice(valuesIdx + 6).trim().replace(/;\s*$/, "");

  const rows = [];
  let current = "";
  let inString = false;

  for (let i = 0; i < valuesPart.length; i++) {
    const ch = valuesPart[i];
    const next = valuesPart[i + 1];

    if (ch === "'" && inString && next === "'") {
      current += "''";
      i++;
      continue;
    }

    if (ch === "'") {
      inString = !inString;
      current += ch;
      continue;
    }

    if (!inString && ch === ")" && next === ",") {
      current += ")";
      rows.push(current.trim());
      current = "";
      i++;
      while (i + 1 < valuesPart.length && /\s/.test(valuesPart[i + 1])) i++;
      continue;
    }

    current += ch;
  }

  if (current.trim()) {
    rows.push(current.trim().replace(/,\s*$/, ""));
  }

  return { head, rows };
}

function toConflictSql(insertSql) {
  return `${insertSql.trim().replace(/;\s*$/, "")} ON CONFLICT ("id") DO NOTHING;`;
}

function buildBatches(head, rows, batchSize = 25) {
  if (rows.length === 0) return [];
  if (rows.length <= batchSize) {
    return [toConflictSql(`${head} ${rows.join(", ")}`)];
  }

  const batches = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    batches.push(toConflictSql(`${head} ${chunk.join(", ")}`));
  }
  return batches;
}

function rowIdSnippet(row) {
  const m = row.match(/^\('([^']+)'/);
  return m ? m[1] : row.slice(0, 40);
}

async function importSqlFile(prisma, table, raw) {
  const { head, rows } = parseInsertStatement(raw);
  if (rows.length === 0) {
    await prisma.$executeRawUnsafe(toConflictSql(raw));
    return { added: 0, skipped: 0, mode: "single" };
  }

  if (ROW_BY_ROW_TABLES.has(table)) {
    let inserted = 0;
    let skipped = 0;
    for (const row of rows) {
      try {
        await prisma.$executeRawUnsafe(toConflictSql(`${head} ${row}`));
        inserted++;
      } catch (err) {
        skipped++;
        console.log(`\n    warn: skipped ${table} row ${rowIdSnippet(row)} — ${err.message.split("\n")[0]}`);
      }
    }
    return { added: inserted, skipped, mode: "row-by-row" };
  }

  const batches = buildBatches(head, rows);
  try {
    for (const batch of batches) {
      await prisma.$executeRawUnsafe(batch);
    }
    return { added: rows.length, skipped: 0, mode: `${batches.length} batch(es)` };
  } catch (bulkErr) {
    console.log(`\n    bulk failed (${bulkErr.message.split("\n")[0]}), retrying row-by-row...`);
    let inserted = 0;
    let skipped = 0;
    for (const row of rows) {
      try {
        await prisma.$executeRawUnsafe(toConflictSql(`${head} ${row}`));
        inserted++;
      } catch {
        skipped++;
      }
    }
    return { added: inserted, skipped, mode: "row-by-row (fallback)" };
  }
}

async function countTable(prisma, table) {
  const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "${table}"`);
  return result[0]?.c ?? 0;
}

async function main() {
  const datasourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!datasourceUrl) {
    throw new Error("Set DIRECT_URL or DATABASE_URL in .env");
  }

  const files = resolveSqlFiles();
  if (files.length === 0) {
    throw new Error("No importable .sql files found in sqltables/");
  }

  const prisma = new PrismaClient({ datasourceUrl });

  console.log("Importing sqltables → PostgreSQL (existing rows kept)\n");
  console.log(`Source: ${SQL_DIR}`);
  console.log(`Target: ${datasourceUrl.replace(/:[^:@/]+@/, ":***@")}\n`);

  const summary = [];

  try {
    for (const { table, path } of files) {
      const before = await countTable(prisma, table);
      const raw = readFileSync(path, "utf8");
      const fileName = path.split(/[/\\]/).pop();

      process.stdout.write(`${table} ← ${fileName}... `);
      const result = await importSqlFile(prisma, table, raw);
      const after = await countTable(prisma, table);
      const added = after - before;

      summary.push({ table, before, after, added, skipped: result.skipped ?? 0, mode: result.mode });
      const skipNote = result.skipped ? `, ${result.skipped} skipped` : "";
      console.log(`+${added} (now ${after}) [${result.mode}${skipNote}]`);
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n=== Import complete ===");
  for (const row of summary) {
    const skip = row.skipped ? `, ${row.skipped} skipped` : "";
    console.log(`  ${row.table.padEnd(22)} ${row.before} → ${row.after} (+${row.added}${skip})`);
  }
  console.log("\nExisting rows with the same id were kept (ON CONFLICT DO NOTHING).");
}

main().catch((err) => {
  console.error("\nImport failed:", err.message);
  process.exit(1);
});
