/**
 * Shared harness for interview E2E / integration tests.
 * Provides structured logging, HTTP helpers, simulations, and report generation.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");

export const DEFAULT_BASE_URL = (process.env.QA_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export function createSuite(name) {
  const startedAt = new Date().toISOString();
  const cases = [];

  const log = (level, message, meta) => {
    const entry = {
      ts: new Date().toISOString(),
      level,
      message,
      ...(meta ? { meta } : {}),
    };
    const prefix = `[${name}]`;
    if (level === "error") console.error(prefix, message, meta ?? "");
    else if (level === "warn") console.warn(prefix, message, meta ?? "");
    else console.log(prefix, message, meta ?? "");
    return entry;
  };

  return {
    name,
    startedAt,
    cases,
    info: (message, meta) => log("info", message, meta),
    warn: (message, meta) => log("warn", message, meta),
    error: (message, meta) => log("error", message, meta),

    async runCase(id, title, fn, { requirement, skipIf } = {}) {
      if (skipIf) {
        const reason = typeof skipIf === "function" ? skipIf() : skipIf;
        if (reason) {
          const entry = {
            id,
            title,
            requirement: requirement ?? null,
            status: "skipped",
            durationMs: 0,
            reason,
            logs: [log("warn", `SKIP: ${title}`, { reason })],
          };
          cases.push(entry);
          return entry;
        }
      }

      const caseLogs = [];
      const caseLog = (level, message, meta) => {
        const entry = log(level, `  ${message}`, meta);
        caseLogs.push(entry);
        return entry;
      };

      const started = Date.now();
      try {
        await fn({
          log: (message, meta) => caseLog("info", message, meta),
          assert: assertCondition,
        });
        const entry = {
          id,
          title,
          requirement: requirement ?? null,
          status: "passed",
          durationMs: Date.now() - started,
          logs: caseLogs,
        };
        cases.push(entry);
        log("info", `PASS: ${title}`);
        return entry;
      } catch (error) {
        const entry = {
          id,
          title,
          requirement: requirement ?? null,
          status: "failed",
          durationMs: Date.now() - started,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          logs: caseLogs,
        };
        cases.push(entry);
        log("error", `FAIL: ${title}`, { error: entry.error });
        return entry;
      }
    },

    summary() {
      const passed = cases.filter((c) => c.status === "passed").length;
      const failed = cases.filter((c) => c.status === "failed").length;
      const skipped = cases.filter((c) => c.status === "skipped").length;
      return {
        suite: name,
        startedAt,
        finishedAt: new Date().toISOString(),
        total: cases.length,
        passed,
        failed,
        skipped,
        ok: failed === 0,
        cases,
      };
    },
  };
}

export function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message ?? "Assertion failed");
  }
}

export async function checkServerReachable(baseUrl = DEFAULT_BASE_URL, timeoutMs = 5_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/api/practice/start`, {
      method: "OPTIONS",
      signal: controller.signal,
    }).catch(() => null);
    if (!response) return false;
    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { response, data, ok: response.ok, status: response.status };
}

/** Mirrors sessionStorage persistence in company-interview-room.tsx */
export function createSessionStorageSimulator() {
  const store = new Map();
  return {
    setItem(key, value) {
      store.set(key, String(value));
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    dump() {
      return Object.fromEntries(store.entries());
    },
  };
}

const STORAGE_KEY_PREFIX = "interview_state_";

export function saveInterviewState(storage, sessionId, state) {
  const key = `${STORAGE_KEY_PREFIX}${sessionId}`;
  storage.setItem(key, JSON.stringify({ ...state, savedAt: state.savedAt ?? Date.now() }));
}

export function loadInterviewState(storage, sessionId) {
  const key = `${STORAGE_KEY_PREFIX}${sessionId}`;
  const data = storage.getItem(key);
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    if (parsed.sessionId !== sessionId) return null;
    const ageMs = Date.now() - (parsed.savedAt ?? 0);
    if (ageMs > 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearInterviewState(storage, sessionId) {
  storage.removeItem(`${STORAGE_KEY_PREFIX}${sessionId}`);
}

/** Mirrors response.create debounce in company-interview-room sendRealtimeEvent */
export function createDuplicateResponseGuard() {
  let responseInFlight = false;
  let scheduledResponseGen = null;
  let respondedUtteranceGen = null;
  const sentEvents = [];

  return {
    sendRealtimeEvent(event, { utteranceGen } = {}) {
      if (event?.type === "response.create") {
        if (responseInFlight) return false;
        if (scheduledResponseGen === utteranceGen && respondedUtteranceGen === utteranceGen) {
          return false;
        }
        responseInFlight = true;
        scheduledResponseGen = utteranceGen ?? null;
        respondedUtteranceGen = utteranceGen ?? null;
      }
      if (event?.type === "response.done" || event?.type === "response.completed") {
        responseInFlight = false;
      }
      sentEvents.push(event);
      return true;
    },
    scheduleResponse(utteranceGen) {
      if (scheduledResponseGen === utteranceGen) return false;
      scheduledResponseGen = utteranceGen;
      return true;
    },
    get sentEvents() {
      return [...sentEvents];
    },
    get responseInFlight() {
      return responseInFlight;
    },
  };
}

/** Mirrors reconnect backoff in company-interview-room scheduleReconnect */
export function computeReconnectBackoffMs(attempt, { baseMs = 800, maxMs = 15_000 } = {}) {
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
}

export async function createPreviewSession(baseUrl, overrides = {}) {
  const email = overrides.email ?? `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const body = {
    candidateName: overrides.candidateName ?? "E2E Test Candidate",
    email,
    domain: overrides.domain ?? "Engineering",
    topic: overrides.topic ?? "Backend APIs",
    durationMin: 3,
    preview: true,
    ...overrides.body,
  };

  const { response, data, ok } = await fetchJson(`${baseUrl}/api/practice/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!ok) {
    throw new Error(`practice/start failed (${response.status}): ${data?.error ?? JSON.stringify(data)}`);
  }

  return { sessionId: data.sessionId, accessCode: data.accessCode, email, body };
}

export async function writeTestReport(report, { label = "interview-e2e" } = {}) {
  const dateDir = new Date().toISOString().slice(0, 10);
  const outDir = path.join(REPO_ROOT, "docs", "qa-artifacts", dateDir);
  await mkdir(outDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `${label}-${stamp}.json`);
  const latestPath = path.join(outDir, `${label}-latest.json`);
  const htmlPath = path.join(outDir, `${label}-latest.html`);

  const payload = JSON.stringify(report, null, 2);
  await writeFile(jsonPath, payload);
  await writeFile(latestPath, payload);
  await writeFile(htmlPath, renderHtmlReport(report));

  return { jsonPath, latestPath, htmlPath, outDir };
}

function renderHtmlReport(report) {
  const suites = Array.isArray(report.suites) ? report.suites : [report];
  const rows = suites
    .flatMap((suite) =>
      (suite.cases ?? []).map((c) => ({
        suite: suite.suite ?? suite.name ?? "unknown",
        ...c,
      })),
    )
    .map(
      (c) => `
    <tr class="${c.status}">
      <td>${escapeHtml(c.suite)}</td>
      <td>${escapeHtml(c.requirement ?? "")}</td>
      <td>${escapeHtml(c.id)}</td>
      <td>${escapeHtml(c.title)}</td>
      <td><strong>${escapeHtml(c.status)}</strong></td>
      <td>${c.durationMs ?? 0}ms</td>
      <td>${escapeHtml(c.error ?? c.reason ?? "")}</td>
    </tr>`,
    )
    .join("");

  const totalPassed = suites.reduce((n, s) => n + (s.passed ?? 0), 0);
  const totalFailed = suites.reduce((n, s) => n + (s.failed ?? 0), 0);
  const totalSkipped = suites.reduce((n, s) => n + (s.skipped ?? 0), 0);
  const ok = totalFailed === 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Interview E2E Report</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #111; }
    h1 { margin-bottom: 0.25rem; }
    .meta { color: #555; margin-bottom: 1.5rem; }
    .badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: 600; }
    .badge.ok { background: #d1fae5; color: #065f46; }
    .badge.fail { background: #fee2e2; color: #991b1b; }
    table { border-collapse: collapse; width: 100%; font-size: 14px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; }
    tr.passed td:nth-child(5) { color: #065f46; }
    tr.failed td:nth-child(5) { color: #991b1b; }
    tr.skipped td:nth-child(5) { color: #92400e; }
  </style>
</head>
<body>
  <h1>Interview E2E Test Report</h1>
  <p class="meta">Generated ${escapeHtml(report.finishedAt ?? new Date().toISOString())}</p>
  <p>
    <span class="badge ${ok ? "ok" : "fail"}">${ok ? "PASS" : "FAIL"}</span>
    &nbsp; ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped
  </p>
  <table>
    <thead>
      <tr>
        <th>Suite</th>
        <th>Requirement</th>
        <th>Case ID</th>
        <th>Title</th>
        <th>Status</th>
        <th>Duration</th>
        <th>Details</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
