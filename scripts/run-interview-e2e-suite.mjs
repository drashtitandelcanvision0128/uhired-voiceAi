/**
 * Master runner for interview automated tests.
 * Runs existing unit scripts + comprehensive E2E suite and emits a combined report.
 *
 * Run: npx tsx --env-file=.env scripts/run-interview-e2e-suite.mjs
 * Browser E2E: QA_RUN_BROWSER=1 npx tsx --env-file=.env scripts/run-interview-e2e-suite.mjs
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_BASE_URL,
  checkServerReachable,
  createSuite,
  writeTestReport,
} from "./lib/e2e-harness.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

const UNIT_SCRIPTS = [
  "scripts/test-speech-transcription.mjs",
  "scripts/test-voice-activity-detection.mjs",
  "scripts/verify-semantic-evaluation.mjs",
  "scripts/test-interview-live-phase.mjs",
  "scripts/test-interview-silence-fallback.mjs",
  "scripts/test-interview-conversation-state.mjs",
  "scripts/test-transcript-confidence-validation.mjs",
  "scripts/test-interview-turn-latency.mjs",
  "scripts/test-interview-intro.mjs",
  "scripts/test-interview-transcript-capture.mjs",
  "scripts/test-interview-room-display.mjs",
  "scripts/test-interview-timer.mjs",
  "scripts/test-interview-duration.mjs",
];

function runCommand(command, args, { env = process.env } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      env,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
        durationMs: Date.now() - started,
      });
    });
  });
}

async function runUnitScript(relativePath) {
  const needsTsx = !relativePath.includes("verify-semantic-evaluation");
  const command = needsTsx ? "npx" : "node";
  const args = needsTsx ? ["tsx", relativePath] : [relativePath];
  return runCommand(command, args);
}

const master = createSuite("interview-e2e-master");
const serverAvailable = await checkServerReachable(DEFAULT_BASE_URL);
master.info(`Repository: ${REPO_ROOT}`);
master.info(`Base URL: ${DEFAULT_BASE_URL}`);
master.info(`Server reachable: ${serverAvailable}`);

for (const script of UNIT_SCRIPTS) {
  const id = script.replace(/^scripts\//, "").replace(/\.mjs$/, "");
  await master.runCase(id, `Unit script: ${script}`, async ({ log }) => {
    const result = await runUnitScript(script);
    if (result.stdout.trim()) log(result.stdout.trim().split("\n").slice(-3).join("\n"));
    if (result.code !== 0) {
      const tail = (result.stderr || result.stdout).trim().split("\n").slice(-8).join("\n");
      throw new Error(`Exit code ${result.code}\n${tail}`);
    }
  });
}

await master.runCase(
  "qa-interview-e2e-comprehensive",
  "Comprehensive E2E suite",
  async ({ log }) => {
    const env = { ...process.env };
    const result = await runCommand("npx", ["tsx", "scripts/qa-interview-e2e-comprehensive.mjs"], { env });
    if (result.stdout.trim()) log(result.stdout.trim().split("\n").slice(-6).join("\n"));
    if (result.code !== 0) {
      const tail = (result.stderr || result.stdout).trim().split("\n").slice(-12).join("\n");
      throw new Error(`Comprehensive suite failed (exit ${result.code})\n${tail}`);
    }
  },
  {
    skipIf: () => (!serverAvailable ? `Server not reachable at ${DEFAULT_BASE_URL} — start npm run dev` : null),
  },
);

const masterSummary = master.summary();
const report = {
  ...masterSummary,
  baseUrl: DEFAULT_BASE_URL,
  serverAvailable,
  suites: [masterSummary],
  scriptsRun: [...UNIT_SCRIPTS, "scripts/qa-interview-e2e-comprehensive.mjs"],
};

const paths = await writeTestReport(report, { label: "interview-e2e-suite" });

console.log("\n=== Interview E2E Master Suite ===");
console.log(`Passed: ${masterSummary.passed}  Failed: ${masterSummary.failed}  Skipped: ${masterSummary.skipped}`);
console.log(`JSON report: ${paths.jsonPath}`);
console.log(`HTML report: ${paths.htmlPath}`);

if (masterSummary.failed > 0) {
  process.exit(1);
}
