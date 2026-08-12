/**
 * End-to-end user journey smoke test (recruiter + candidate).
 * Run: node scripts/test-user-journey.mjs
 * Env: QA_BASE_URL (default http://localhost:3000)
 */
import { readFile } from "node:fs/promises";

const BASE = (process.env.QA_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const LOGIN = {
  companyName: "Uhired",
  companyDomain: "uhired.com",
  companyEmail: "admin@uhired.com",
  passcode: "admin123",
};

const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

function extractCookie(header) {
  if (!header) return "";
  const parts = Array.isArray(header) ? header : [header];
  return parts.map((c) => c.split(";")[0]).join("; ");
}

function mergeCookies(...parts) {
  const jar = new Map();
  for (const part of parts) {
    if (!part) continue;
    for (const pair of part.split(";").map((s) => s.trim()).filter(Boolean)) {
      const [key, ...rest] = pair.split("=");
      if (key) jar.set(key, rest.join("="));
    }
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function json(url, opts = {}, cookieJar = "") {
  const headers = new Headers(opts.headers ?? {});
  if (cookieJar) headers.set("cookie", cookieJar);
  const res = await fetch(`${BASE}${url}`, { ...opts, headers });
  const setCookie = res.headers.getSetCookie?.() ?? res.headers.get("set-cookie");
  const nextJar = mergeCookies(cookieJar, extractCookie(setCookie));
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { res, data, cookies: nextJar };
}

async function main() {
  console.log(`=== User Journey Tests @ ${BASE} ===\n`);

  for (const [path, label] of [
    ["/", "Homepage"],
    ["/company-login", "Company login"],
    ["/candidate", "Candidate entry"],
    ["/candidate?code=TEST123", "Candidate invite link"],
  ]) {
    const r = await fetch(`${BASE}${path}`);
    if (r.status === 200) pass(`Page loads: ${label}`, `HTTP ${r.status}`);
    else fail(`Page loads: ${label}`, `HTTP ${r.status}`);
  }

  const login = await json("/api/company-auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(LOGIN),
  });
  const cookie = extractCookie(login.res.headers.getSetCookie?.() ?? login.res.headers.get("set-cookie"));
  if (login.res.status === 200 && cookie) pass("Recruiter: Company login");
  else {
    fail("Recruiter: Company login", JSON.stringify(login.data));
    printSummary();
    process.exit(1);
  }

  let cookieJar = cookie;

  const dash = await json("/api/admin/dashboard?period=30d", {}, cookieJar);
  if (dash.res.ok) pass("Recruiter: Dashboard API", `sessions=${dash.data?.statusCounts?.total ?? "?"}`);
  else fail("Recruiter: Dashboard API", dash.data?.error || String(dash.res.status));

  const sessionsAll = await json(
    "/api/admin/sessions?page=1&pageSize=5&status=all&search=&minScore=&maxScore=&from=&to=",
    {},
    cookieJar,
  );
  if (sessionsAll.res.ok) pass("Recruiter: Sessions list API (status=all)");
  else fail("Recruiter: Sessions list API (status=all)", sessionsAll.data?.error?.slice?.(0, 120) || sessionsAll.res.status);

  const testEmail = `journey-${Date.now()}@example.com`;
  const invite = await json(
    "/api/admin/requirements/invite-candidates",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
      source: "manual",
      emails: [testEmail],
      requirement: {
        positionTitle: "Journey Test Role",
        domain: "Engineering",
        topic: "Test",
        durationMin: 15,
        jobDescription: "Test JD for user journey verification.",
        keySkills: ["Node.js"],
        maxOptionalQuestions: 2,
      },
    }),
    },
    cookieJar,
  );
  if (invite.res.ok && invite.data?.sentCount >= 1) pass("Recruiter: Invite candidate", testEmail);
  else fail("Recruiter: Invite candidate", invite.data?.error || String(invite.res.status));

  let accessCode = null;
  if (invite.res.ok && Array.isArray(invite.data?.invites)) {
    const row = invite.data.invites.find((i) => i.email === testEmail);
    accessCode = row?.accessCode ?? null;
  }
  if (!accessCode) {
    const reqs = await json("/api/admin/requirements?page=1&pageSize=10&search=", {}, cookieJar);
    if (reqs.res.ok && Array.isArray(reqs.data?.requirements)) {
      for (const req of reqs.data.requirements) {
        const inv = (req.candidateInvites || req.invites || []).find((i) => i.email === testEmail);
        if (inv?.accessCode) {
          accessCode = inv.accessCode;
          break;
        }
      }
    }
  }
  if (accessCode) pass("Recruiter: Access code generated", accessCode);
  else fail("Recruiter: Access code generated", "not found in requirements list");

  let sessionId = null;
  let candidateCookies = "";
  if (accessCode) {
    const verify = await json(
      "/api/candidate/verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessCode,
          candidateName: "Journey Test User",
          email: testEmail,
        }),
      },
      "",
    );
    candidateCookies = verify.cookies;
    sessionId = verify.data?.sessionId;
    if (verify.res.ok && sessionId) pass("Candidate: Verify invite", `sessionId=${sessionId}`);
    else fail("Candidate: Verify invite", verify.data?.error || String(verify.res.status));
  }

  if (sessionId) {
    const details = await json(`/api/interview/${sessionId}/details`, {}, candidateCookies);
    if (details.res.ok && details.data?.session?.status === "READY") pass("Candidate: Session READY");
    else fail("Candidate: Session READY", details.data?.session?.status || String(details.res.status));

    const interviewPage = await fetch(`${BASE}/interview/${sessionId}`);
    if (interviewPage.status === 200) pass("Candidate: Interview page loads");
    else fail("Candidate: Interview page loads", `HTTP ${interviewPage.status}`);

    await json(
      `/api/interview/${sessionId}/consent`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      candidateCookies,
    );
    await json(
      `/api/interview/${sessionId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "LIVE", markStartedAt: true }),
      },
      candidateCookies,
    );

    const complete = await json(
      `/api/interview/${sessionId}/complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        durationSec: 90,
        transcript: [
          { speaker: "interviewer", text: "Tell me about yourself.", orderIndex: 0 },
          {
            speaker: "candidate",
            text: "I am a software engineer with five years of experience.",
            orderIndex: 1,
            confidence: 0.92,
          },
        ],
      }),
    },
    candidateCookies,
    );

    const after = await json(`/api/interview/${sessionId}/details`, {}, candidateCookies);
    if (complete.res.ok && complete.data?.score) {
      pass("Candidate: Interview complete + scorecard", `score=${complete.data.score.overallScore}`);
    } else {
      fail("Candidate: Interview complete + scorecard", complete.data?.error || String(complete.res.status));
    }

    if (after.data?.session?.status === "COMPLETED") pass("Candidate: Session COMPLETED");
    else fail("Candidate: Session COMPLETED", after.data?.session?.status);
    const sessionDetail = await json(`/api/admin/session/${sessionId}`, {}, cookieJar);
    if (sessionDetail.res.ok && sessionDetail.data?.session?.status === "COMPLETED") {
      pass("Recruiter: Scorecard available in session detail");
    } else {
      fail("Recruiter: Scorecard available in session detail", sessionDetail.data?.error || String(sessionDetail.res.status));
    }
  }

  const src = await readFile("src/components/company-interview-room.tsx", "utf8");
  if (src.includes("Go to homepage") && src.includes('href="/"')) {
    pass("Candidate: Post-interview redirects to homepage (/)");
  } else {
    fail("Candidate: Post-interview redirects to homepage (/)");
  }

  printSummary();
  if (results.some((r) => !r.ok)) process.exit(1);
}

function printSummary() {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log("\n=== SUMMARY ===");
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  if (failed) {
    console.log("\nFailures:");
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`  - ${r.name}: ${r.detail}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
