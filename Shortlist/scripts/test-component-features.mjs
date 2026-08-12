/**
 * Component feature smoke tests for recently added flows.
 * Run: node scripts/test-component-features.mjs
 */
const BASE = (process.env.QA_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const LOGIN = {
  companyName: "Uhired",
  companyDomain: "uhired.com",
  companyEmail: "admin@uhired.com",
  passcode: "admin123",
};
const MASTER_LOGIN = {
  adminEmail: process.env.MASTER_ADMIN_EMAIL || "master@uhired.com",
  passcode: process.env.MASTER_ADMIN_PASSWORD || "master@123",
  trustDevice: true,
};

const results = [];
function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(`PASS: ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.log(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
}

function extractCookie(header) {
  if (!header) return "";
  const parts = Array.isArray(header) ? header : [header];
  return parts.map((c) => c.split(";")[0]).join("; ");
}

async function json(url, opts = {}, cookie = "") {
  const headers = new Headers(opts.headers ?? {});
  if (cookie) headers.set("cookie", cookie);
  const res = await fetch(`${BASE}${url}`, { ...opts, headers });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 200) };
  }
  return { res, data };
}

async function main() {
  console.log(`=== Component Feature Tests @ ${BASE} ===\n`);

  // Pages
  for (const [path, label] of [
    ["/master-login", "Master login page"],
    ["/master/interview-analytics", "Master interview analytics page"],
    ["/admin", "Admin portal page"],
  ]) {
    const r = await fetch(`${BASE}${path}`);
    if (r.status === 200) pass(`Page: ${label}`, `HTTP ${r.status}`);
    else fail(`Page: ${label}`, `HTTP ${r.status}`);
  }

  // Candidate preview - invalid
  const badPreview = await json("/api/candidate/preview?code=NOT_A_REAL_CODE");
  if (badPreview.res.ok && badPreview.data?.valid === false) {
    pass("Candidate preview: invalid code rejected");
  } else {
    fail("Candidate preview: invalid code rejected", JSON.stringify(badPreview.data));
  }

  // Company login + save requirement
  const login = await json("/api/company-auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(LOGIN),
  });
  const companyCookie = extractCookie(login.res.headers.getSetCookie?.() ?? login.res.headers.get("set-cookie"));
  if (!login.res.ok || !companyCookie) {
    fail("Admin: login for save requirement");
    printSummary();
    process.exit(1);
  }
  pass("Admin: login");

  const saveReq = await json(
    "/api/admin/requirements",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Component Test Role",
        domain: "Component Test Role",
        topic: "Automated component test requirement",
        durationMin: 15,
        jobDescription: "Testing save requirement without sending invites.",
        keySkills: ["Testing", "Automation"],
        mandatoryQuestions: ["Describe your testing approach."],
        maxOptionalQuestions: 1,
      }),
    },
    companyCookie,
  );
  if (saveReq.res.ok && saveReq.data?.requirementId) {
    pass("Admin: save requirement without invite", saveReq.data.requirementId);
  } else {
    fail("Admin: save requirement without invite", saveReq.data?.error || saveReq.res.status);
  }

  const reqs = await json("/api/admin/requirements?page=1&pageSize=20&search=Component%20Test", {}, companyCookie);
  const foundReq = reqs.data?.requirements?.some((r) => r.requirementId === saveReq.data?.requirementId);
  if (reqs.res.ok && foundReq) pass("Admin: saved requirement visible in list");
  else fail("Admin: saved requirement visible in list");

  // Invite + preview with valid code
  const testEmail = `component-${Date.now()}@example.com`;
  const invite = await json(
    "/api/admin/requirements/invite-candidates",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "manual",
        emails: [testEmail],
        requirement: {
          positionTitle: "Preview Test Role",
          domain: "Preview Test Role",
          topic: "Preview API test",
          durationMin: 20,
          jobDescription: "Preview landing page test role.",
          keySkills: ["Communication"],
          maxOptionalQuestions: 2,
        },
      }),
    },
    companyCookie,
  );
  const accessCode = invite.data?.invites?.find((i) => i.email === testEmail)?.accessCode;
  if (invite.res.ok && accessCode) pass("Admin: invite for preview test", accessCode);
  else fail("Admin: invite for preview test", invite.data?.error || invite.res.status);

  if (accessCode) {
    const preview = await json(`/api/candidate/preview?code=${encodeURIComponent(accessCode)}`);
    if (preview.res.ok && preview.data?.valid && preview.data?.roleTitle) {
      pass("Candidate preview: valid invite", preview.data.roleTitle);
    } else {
      fail("Candidate preview: valid invite", JSON.stringify(preview.data));
    }
    if (preview.data?.companyName) pass("Candidate preview: shows company name", preview.data.companyName);
    else fail("Candidate preview: shows company name");
    if (preview.data?.emailHint) pass("Candidate preview: masked email hint", preview.data.emailHint);
    else fail("Candidate preview: masked email hint");
  }

  // Master interview analytics
  const masterLogin = await json("/api/master/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(MASTER_LOGIN),
  });
  const masterCookie = extractCookie(
    masterLogin.res.headers.getSetCookie?.() ?? masterLogin.res.headers.get("set-cookie"),
  );
  if (masterLogin.res.ok && masterCookie) pass("Master: login");
  else {
    fail("Master: login", masterLogin.data?.error || masterLogin.res.status);
    printSummary();
    process.exit(1);
  }

  const analytics = await json("/api/master/interview-analytics?period=30d", {}, masterCookie);
  if (analytics.res.ok && analytics.data?.summary?.totalRequirements != null) {
    pass(
      "Master: interview analytics API",
      `requirements=${analytics.data.summary.requirementsInPeriod}, sessions=${analytics.data.summary.sessionsInPeriod}`,
    );
  } else {
    fail("Master: interview analytics API", analytics.data?.error || analytics.res.status);
  }

  if (Array.isArray(analytics.data?.companyRows) && analytics.data.companyRows.length > 0) {
    pass("Master: per-company analytics rows", `${analytics.data.companyRows.length} companies`);
  } else {
    fail("Master: per-company analytics rows");
  }

  if (Array.isArray(analytics.data?.trends?.requirementsCreated)) {
    pass("Master: requirement creation trend");
  } else {
    fail("Master: requirement creation trend");
  }

  if (Array.isArray(analytics.data?.trends?.sessionsConducted)) {
    pass("Master: sessions conducted trend");
  } else {
    fail("Master: sessions conducted trend");
  }

  const unauthAnalytics = await json("/api/master/interview-analytics?period=30d");
  if (unauthAnalytics.res.status === 401) pass("Master: analytics requires auth");
  else fail("Master: analytics requires auth", String(unauthAnalytics.res.status));

  printSummary();
  if (results.some((r) => !r.ok)) process.exit(1);
}

function printSummary() {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n=== SUMMARY ===\nPassed: ${passed}  Failed: ${failed}`);
  if (failed) {
    console.log("\nFailures:");
    for (const r of results.filter((x) => !x.ok)) console.log(`  - ${r.name}: ${r.detail}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
