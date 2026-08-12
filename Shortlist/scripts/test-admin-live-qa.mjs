/**
 * Live QA: Admin dashboard checklist (login + API + rendered UI smoke).
 * Run: node scripts/test-admin-live-qa.mjs
 * Env: ADMIN_QA_BASE_URL (default http://localhost:3000)
 */

const BASE = (process.env.ADMIN_QA_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const LOGIN = {
  companyName: "Uhired",
  companyDomain: "uhired.com",
  companyEmail: "admin@uhired.com",
  passcode: "admin123",
};

function log(section, msg) {
  console.log(`[${section}] ${msg}`);
}

function extractCookie(setCookieHeader) {
  if (!setCookieHeader) return "";
  const parts = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return parts.map((c) => c.split(";")[0]).join("; ");
}

async function login() {
  const res = await fetch(`${BASE}/api/company-auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(LOGIN),
  });
  const data = await res.json().catch(() => ({}));
  const cookie = extractCookie(res.headers.getSetCookie?.() ?? res.headers.get("set-cookie"));
  return { status: res.status, data, cookie, ok: res.ok };
}

async function apiGet(path, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, ok: res.ok };
}

async function apiPost(path, cookie, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, ok: res.ok };
}

async function main() {
  console.log(`Admin live QA @ ${BASE}\n`);

  const loginResult = await login();
  log("login", `status=${loginResult.status} ok=${loginResult.ok}`);
  if (!loginResult.ok || !loginResult.cookie) {
    console.error("FAIL: cannot log in — aborting live checks.");
    process.exit(1);
  }
  const cookie = loginResult.cookie;

  const refreshEndpoints = [
    ["/api/admin/sessions?page=1&pageSize=20&status=all&search=&minScore=&maxScore=&from=&to=&recentLimit=6", "sessions"],
    ["/api/admin/dashboard?period=30d", "dashboard"],
    ["/api/admin/candidates", "candidates"],
    ["/api/admin/requirements?page=1&pageSize=20&search=", "requirements"],
    ["/api/company-auth/session", "company session"],
  ];

  console.log("\n--- Load / refresh data (backend calls) ---");
  let refreshOk = true;
  for (const [path, label] of refreshEndpoints) {
    const r = await apiGet(path, cookie);
    log("refresh", `${label}: HTTP ${r.status} ${r.ok ? "OK" : "FAIL"}`);
    if (!r.ok) {
      refreshOk = false;
      log("refresh", `  error: ${r.data?.error ?? JSON.stringify(r.data).slice(0, 120)}`);
    }
  }

  console.log("\n--- Analytics (dashboard API) ---");
  const dash = await apiGet("/api/admin/dashboard?period=30d", cookie);
  if (dash.ok) {
    const d = dash.data;
    const empty =
      (d.statusCounts?.total ?? 0) === 0 &&
      (d.candidatesCount ?? 0) === 0 &&
      (d.requirementsCount ?? 0) === 0;
    log(
      "analytics",
      `HTTP ${dash.status} — ${empty ? "EMPTY (valid zero-state)" : "HAS DATA"} — period=${d.periodLabel}`,
    );
    log(
      "analytics",
      `counts: sessions=${d.statusCounts?.total ?? "?"} candidates=${d.candidatesCount ?? "?"} requirements=${d.requirementsCount ?? "?"}`,
    );
    const requiredKeys = [
      "period",
      "statusCounts",
      "candidatesCount",
      "requirementsCount",
      "sessionsTrend",
      "comparisons",
    ];
    const missing = requiredKeys.filter((k) => !(k in d));
    if (missing.length) {
      log("analytics", `FAIL: missing keys: ${missing.join(", ")}`);
      refreshOk = false;
    }
  } else {
    log("analytics", `FAIL: HTTP ${dash.status} — ${dash.data?.error ?? "unknown"}`);
    refreshOk = false;
  }

  console.log("\n--- Send Interview Invites (replaces Generate Requirement Code) ---");
  const testEmail = `qa-${Date.now()}@example.com`;
  const invitePayload = {
    source: "manual",
    emails: [testEmail],
    requirement: {
      positionTitle: "QA Test Engineer",
      domain: "QA Test Engineer",
      topic: "Automated testing role for admin QA verification",
      durationMin: 15,
      jobDescription:
        "We need a QA engineer to verify admin portal flows including invite sending and analytics.",
      keySkills: ["Testing", "Automation"],
      maxOptionalQuestions: 3,
    },
  };
  const invite = await apiPost("/api/admin/requirements/invite-candidates", cookie, invitePayload);
  log("invite", `HTTP ${invite.status} — ${invite.data?.error ?? (invite.ok ? "success" : "failed")}`);
  if (invite.status === 401) {
    log("invite", "401 Unauthorized — session cookie not accepted by invite API");
  } else if (invite.status === 403) {
    log("invite", "403 Forbidden — authenticated but not permitted");
  } else if (invite.ok) {
    log("invite", `sentCount=${invite.data?.sentCount ?? "?"} summary=${JSON.stringify(invite.data?.summary ?? {})}`);
  }

  console.log("\n--- Invite without auth (expect 401) ---");
  const unauth = await apiPost("/api/admin/requirements/invite-candidates", "", invitePayload);
  log("invite-unauth", `HTTP ${unauth.status} — ${unauth.data?.error ?? ""}`);

  console.log("\n--- Rendered admin bundle strings (client JS) ---");
  const adminPage = await fetch(`${BASE}/admin`, { headers: { cookie } });
  const html = await adminPage.text();
  const legacyLabels = ["Generate Requirement Code", "Requirement Control"];
  for (const label of legacyLabels) {
    const inHtml = html.includes(label);
    log("ui-source", `"${label}" in /admin HTML: ${inHtml ? "FOUND (unexpected)" : "not found (good)"}`);
  }
  const hasInviteCandidates = html.includes("Invite Candidates") || /Invite Candidates/.test(html);
  log("ui-source", `"Invite Candidates" in /admin HTML: ${hasInviteCandidates}`);

  const chunkUrls = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+admin[^"']+\.js/g)].map((m) => m[0]);
  let legacyInBundle = 0;
  let inviteInBundle = 0;
  for (const url of chunkUrls.slice(0, 5)) {
    try {
      const js = await (await fetch(`${BASE}${url}`)).text();
      if (js.includes("Generate Requirement Code")) legacyInBundle++;
      if (js.includes("Invite Candidates")) inviteInBundle++;
    } catch {
      /* ignore */
    }
  }
  log("ui-source", `admin chunks scanned: ${chunkUrls.length}, legacy label in bundle: ${legacyInBundle}, Invite Candidates refs: ${inviteInBundle}`);

  console.log("\n=== Summary ===");
  console.log(`Login: PASS (${loginResult.status})`);
  console.log(`Load/refresh APIs: ${refreshOk ? "PASS (all returned 2xx)" : "FAIL"}`);
  console.log(`Analytics: ${dash.ok ? "PASS (API works)" : "FAIL"}`);
  console.log(
    `Invite flow: ${invite.ok ? `PASS (${invite.status})` : `CHECK — HTTP ${invite.status} — ${invite.data?.error ?? ""}`}`,
  );
  console.log(`Duplicate Generate Requirement Code: ${legacyInBundle === 0 ? "REMOVED" : "STILL PRESENT"}`);

  if (!refreshOk || !dash.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
