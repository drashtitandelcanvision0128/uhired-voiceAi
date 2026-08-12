/**
 * Master QA suite — run all automated platform tests.
 * Requires dev server on QA_BASE_URL (default http://localhost:3000).
 *
 * Usage:
 *   node scripts/run-qa-suite.mjs
 *   npm run test:qa
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const BASE = process.env.QA_BASE_URL ?? "http://localhost:3000";

const suites = [
  { name: "User Journey (Recruiter + Candidate E2E)", script: "test-user-journey.mjs" },
  { name: "Admin Live QA", script: "test-admin-live-qa.mjs" },
  { name: "Component Features", script: "test-component-features.mjs" },
  { name: "Video Recording + AI Scorecard", script: "test-recording-scorecard.mjs" },
  { name: "Interview Unit Tests", npm: "test:interview:unit" },
];

function runNode(script) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, script)], {
      cwd: ROOT,
      env: { ...process.env, QA_BASE_URL: BASE },
      stdio: "inherit",
      shell: false,
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

function runNpm(script) {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", script], {
      cwd: ROOT,
      env: { ...process.env, QA_BASE_URL: BASE },
      stdio: "inherit",
      shell: true,
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function checkServer() {
  try {
    const res = await fetch(`${BASE.replace(/\/$/, "")}/`);
    return res.status < 500;
  } catch {
    return false;
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║         UHIRED — MASTER QA TEST SUITE            ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`Base URL: ${BASE}\n`);

  const up = await checkServer();
  if (!up) {
    console.error(`ERROR: Server not reachable at ${BASE}`);
    console.error("Start the app first: npm run dev");
    process.exit(1);
  }
  console.log("Server: OK\n");

  const results = [];
  for (const suite of suites) {
    console.log(`\n── ${suite.name} ──\n`);
    const code = suite.npm ? await runNpm(suite.npm) : await runNode(suite.script);
    results.push({ name: suite.name, ok: code === 0, code });
  }

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║                   SUMMARY                        ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : ` (exit ${r.code})`}`);
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`\nTotal: ${passed}/${results.length} passed, ${failed} failed`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
