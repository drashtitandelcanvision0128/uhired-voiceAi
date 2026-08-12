/**
 * QA: Re-login load time vs candidate volume, Razorpay API states, mobile viewport captures.
 * Run: node scripts/qa-performance-payments-mobile.mjs
 * Env: QA_BASE_URL (default http://localhost:3000)
 */

import { PrismaClient } from "@prisma/client";
import { createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.QA_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT_DIR = path.join(__dirname, "..", "docs", "qa-artifacts", new Date().toISOString().slice(0, 10));

const PERF_COMPANY = {
  name: "PerfTest QA Co",
  domain: "perftest.qa",
  adminEmail: "perf-admin@perftest.qa",
  passcode: "perf-qa-2026",
};

const TIERS = [10, 50, 105];

const prisma = new PrismaClient();

function ms(start) {
  return Math.round(performance.now() - start);
}

function extractCookie(setCookieHeader) {
  if (!setCookieHeader) return "";
  const parts = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  return parts.map((c) => c.split(";")[0]).join("; ");
}

async function timedFetch(label, url, options = {}) {
  const start = performance.now();
  const res = await fetch(url, { cache: "no-store", ...options });
  const elapsed = ms(start);
  let body = null;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    body = await res.json().catch(() => null);
  } else {
    body = await res.text().catch(() => null);
  }
  return { label, status: res.status, ok: res.ok, elapsed, body, headers: res.headers };
}

async function login() {
  const start = performance.now();
  const res = await fetch(`${BASE}/api/company-auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyName: PERF_COMPANY.name,
      companyDomain: PERF_COMPANY.domain,
      companyEmail: PERF_COMPANY.adminEmail,
      passcode: PERF_COMPANY.passcode,
    }),
  });
  const data = await res.json().catch(() => ({}));
  const cookie = extractCookie(res.headers.getSetCookie?.() ?? res.headers.get("set-cookie"));
  return { ok: res.ok, status: res.status, elapsed: ms(start), cookie, data };
}

async function logout(cookie) {
  await fetch(`${BASE}/api/company-auth/logout`, {
    method: "POST",
    headers: { cookie },
  });
}

async function measureRelogin(cookie) {
  const endpoints = [
    ["/api/company-auth/session", "auth session"],
    ["/api/admin/dashboard?period=30d", "dashboard"],
    [
      "/api/admin/sessions?page=1&pageSize=10&status=ALL&search=&minScore=&maxScore=&from=&to=&recentLimit=6",
      "sessions",
    ],
  ];

  const parallelStart = performance.now();
  const parallel = await Promise.all(
    endpoints.map(([path, label]) =>
      timedFetch(label, `${BASE}${path}`, { headers: { cookie } }),
    ),
  );
  const parallelWall = ms(parallelStart);

  const candidates = await timedFetch(
    "candidates",
    `${BASE}/api/admin/candidates`,
    { headers: { cookie } },
  );

  const adminPage = await timedFetch("admin HTML", `${BASE}/admin`, { headers: { cookie } });

  return {
    parallelWall,
    parallel,
    candidates,
    adminPage,
    totalBackend: parallel.reduce((s, r) => s + r.elapsed, 0),
    slowest: Math.max(...parallel.map((r) => r.elapsed), candidates.elapsed),
  };
}

function generateAccessCode(prefix = "QA") {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 6; i += 1) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${prefix}-${token}`;
}

async function ensurePerfCompany() {
  const company = await prisma.company.upsert({
    where: { name: PERF_COMPANY.name },
    create: {
      name: PERF_COMPANY.name,
      domain: PERF_COMPANY.domain,
      adminEmail: PERF_COMPANY.adminEmail,
      adminPasscode: PERF_COMPANY.passcode,
      isActive: true,
    },
    update: {
      domain: PERF_COMPANY.domain,
      adminEmail: PERF_COMPANY.adminEmail,
      adminPasscode: PERF_COMPANY.passcode,
      isActive: true,
    },
  });

  let requirement = await prisma.requirement.findFirst({
    where: { companyId: company.id, topic: "Perf QA requirement" },
  });
  if (!requirement) {
    requirement = await prisma.requirement.create({
      data: {
        companyId: company.id,
        domain: "Software Engineering",
        topic: "Perf QA requirement",
        durationMin: 15,
        jobDescription: "Synthetic load-test requirement",
        keySkills: ["Testing"],
      },
    });
  }
  return { company, requirement };
}

async function countActiveCandidates(companyId) {
  return prisma.candidate.count({ where: { companyId, isArchived: false } });
}

async function seedCandidatesToCount(companyId, requirementId, targetCount) {
  const current = await countActiveCandidates(companyId);
  const toAdd = Math.max(0, targetCount - current);
  if (toAdd === 0) return { added: 0, total: current };

  const batchSize = 25;
  let added = 0;
  for (let offset = 0; offset < toAdd; offset += batchSize) {
    const chunk = Math.min(batchSize, toAdd - offset);
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < chunk; i += 1) {
        const n = current + offset + i + 1;
        const candidate = await tx.candidate.create({
          data: {
            companyId,
            name: `Perf Candidate ${n}`,
            email: `perf-candidate-${n}@perftest.qa`,
          },
        });
        const session = await tx.interviewSession.create({
          data: {
            accessCode: generateAccessCode("PERF"),
            sessionType: "COMPANY",
            status: "COMPLETED",
            candidateName: candidate.name,
            candidateEmail: candidate.email,
            candidateId: candidate.id,
            companyId,
            requirementId,
            domain: "Software Engineering",
            topic: "Perf QA requirement",
            durationMin: 15,
            startedAt: new Date(Date.now() - 20 * 60 * 1000),
            endedAt: new Date(Date.now() - 5 * 60 * 1000),
          },
        });
        await tx.scorecard.create({
          data: {
            sessionId: session.id,
            overallScore: 40 + (n % 55),
            communication: 50,
            domainDepth: 45,
            confidence: 55,
            summary: "Synthetic perf-test scorecard",
          },
        });
      }
    });
    added += chunk;
    process.stdout.write(`  seeded +${chunk} (total target ${targetCount})\n`);
  }
  return { added, total: targetCount };
}

async function testRazorpayStates() {
  const results = [];
  const practiceEmail = `razorpay-qa-${Date.now()}@example.com`;

  const orderStart = performance.now();
  const orderRes = await fetch(`${BASE}/api/practice/payment/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      candidateName: "Razorpay QA User",
      email: practiceEmail,
      domain: "Software Engineering",
      topic: "Practice payment QA",
      durationMin: 10,
    }),
  });
  const orderData = await orderRes.json().catch(() => ({}));
  results.push({
    step: "Create order",
    status: orderRes.status,
    ok: orderRes.ok,
    elapsedMs: ms(orderStart),
    detail: orderRes.ok
      ? `orderId=${orderData.orderId} amountPaise=${orderData.amountPaise}`
      : orderData.error ?? "unknown",
  });

  if (!orderRes.ok || !orderData.orderId) return results;

  const badVerifyStart = performance.now();
  const badVerify = await fetch(`${BASE}/api/practice/payment/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId: orderData.orderId,
      paymentId: "pay_fake_invalid",
      signature: "invalid_signature",
    }),
  });
  const badVerifyData = await badVerify.json().catch(() => ({}));
  results.push({
    step: "Verify invalid signature",
    status: badVerify.status,
    ok: badVerify.ok,
    elapsedMs: ms(badVerifyStart),
    detail: badVerifyData.error ?? JSON.stringify(badVerifyData),
  });

  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (secret) {
    const fakePaymentId = `pay_qa_${Date.now()}`;
    const signature = createHmac("sha256", secret)
      .update(`${orderData.orderId}|${fakePaymentId}`)
      .digest("hex");

    const goodVerifyStart = performance.now();
    const goodVerify = await fetch(`${BASE}/api/practice/payment/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: orderData.orderId,
        paymentId: fakePaymentId,
        signature,
      }),
    });
    const goodVerifyData = await goodVerify.json().catch(() => ({}));
    results.push({
      step: "Verify valid HMAC (simulated payment)",
      status: goodVerify.status,
      ok: goodVerify.ok,
      elapsedMs: ms(goodVerifyStart),
      detail: goodVerify.ok ? "VERIFIED" : goodVerifyData.error ?? "failed",
    });

    if (goodVerify.ok) {
      const startPractice = performance.now();
      const practiceRes = await fetch(`${BASE}/api/practice/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: "Razorpay QA User",
          email: practiceEmail,
          domain: "Software Engineering",
          topic: "Practice payment QA",
          durationMin: 10,
          paymentOrderId: orderData.orderId,
        }),
      });
      const practiceData = await practiceRes.json().catch(() => ({}));
      results.push({
        step: "Start practice after payment",
        status: practiceRes.status,
        ok: practiceRes.ok,
        elapsedMs: ms(startPractice),
        detail: practiceRes.ok
          ? `sessionId=${practiceData.sessionId} → user would redirect to /interview/${practiceData.sessionId}`
          : practiceData.error ?? "failed",
      });
    }
  }

  const cancelStart = performance.now();
  const cancelOrder = await fetch(`${BASE}/api/practice/payment/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      candidateName: "",
      email: "not-an-email",
      domain: "x",
      topic: "x",
      durationMin: 10,
    }),
  });
  const cancelData = await cancelOrder.json().catch(() => ({}));
  results.push({
    step: "Validation error (empty name / bad email)",
    status: cancelOrder.status,
    ok: cancelOrder.ok,
    elapsedMs: ms(cancelStart),
    detail: cancelData.error ?? JSON.stringify(cancelData),
  });

  return results;
}

async function captureMobileScreenshots() {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    return {
      ok: false,
      error: "playwright not installed — run: npx playwright install chromium",
      shots: [],
    };
  }

  await mkdir(OUT_DIR, { recursive: true });
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });

  const shots = [];
  const pages = [
    { url: `${BASE}/candidate`, file: "mobile-candidate-home.png", name: "Candidate homepage" },
    { url: `${BASE}/company-login`, file: "mobile-company-login.png", name: "Company login (pre-admin)" },
  ];

  for (const p of pages) {
    const page = await context.newPage();
    await page.goto(p.url, { waitUntil: "networkidle", timeout: 60_000 });
    await page.waitForTimeout(800);
    const filePath = path.join(OUT_DIR, p.file);
    await page.screenshot({ path: filePath, fullPage: true });
    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        hasHorizontalOverflow: doc.scrollWidth > doc.clientWidth + 2,
        bodyHeight: document.body?.scrollHeight ?? 0,
      };
    });
    shots.push({ ...p, filePath, metrics });
    await page.close();
  }

  const login = await loginPerf();
  if (login.cookie) {
    const cookieParts = login.cookie.split(";")[0];
    const eq = cookieParts.indexOf("=");
    const cookieName = cookieParts.slice(0, eq);
    const cookieValue = cookieParts.slice(eq + 1);
    const adminPage = await context.newPage();
    await adminPage.context().addCookies([
      {
        name: cookieName,
        value: cookieValue,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await adminPage.goto(`${BASE}/admin`, { waitUntil: "networkidle", timeout: 90_000 });
    await adminPage.waitForTimeout(1500);
    const filePath = path.join(OUT_DIR, "mobile-admin-dashboard.png");
    await adminPage.screenshot({ path: filePath, fullPage: true });
    const metrics = await adminPage.evaluate(() => {
      const doc = document.documentElement;
      const overflowEls = [...document.querySelectorAll("*")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.right > window.innerWidth + 2;
      }).length;
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        hasHorizontalOverflow: doc.scrollWidth > doc.clientWidth + 2,
        elementsPastViewport: overflowEls,
        bodyHeight: document.body?.scrollHeight ?? 0,
      };
    });
    shots.push({
      url: `${BASE}/admin`,
      file: "mobile-admin-dashboard.png",
      name: "Admin dashboard (logged in)",
      filePath,
      metrics,
    });
    await adminPage.close();
  }

  await browser.close();
  return { ok: true, shots, outDir: OUT_DIR };
}

async function loginPerf() {
  return login();
}

async function main() {
  console.log(`QA Performance / Payments / Mobile @ ${BASE}\n`);

  const { company, requirement } = await ensurePerfCompany();
  console.log(`Perf company: ${company.name} (${company.id})\n`);

  const perfResults = [];

  for (const tier of TIERS) {
    console.log(`--- Tier: ${tier} candidates ---`);
    await seedCandidatesToCount(company.id, requirement.id, tier);
    const actual = await countActiveCandidates(company.id);
    console.log(`  active candidates in DB: ${actual}`);

    await logout("");
    const loginResult = await login();
    if (!loginResult.ok) {
      console.error("Login failed:", loginResult);
      process.exit(1);
    }
    const relogin = await measureRelogin(loginResult.cookie);
    await logout(loginResult.cookie);

    const row = {
      tier,
      candidatesInDb: actual,
      loginMs: loginResult.elapsed,
      parallelWallMs: relogin.parallelWall,
      slowestApiMs: relogin.slowest,
      candidatesApiMs: relogin.candidates.elapsed,
      adminHtmlMs: relogin.adminPage.elapsed,
      apis: Object.fromEntries(
        relogin.parallel.map((r) => [r.label, { ms: r.elapsed, status: r.status }]),
      ),
    };
    perfResults.push(row);
    console.log(
      `  re-login: login=${row.loginMs}ms | parallel wall=${row.parallelWallMs}ms | slowest API=${row.slowestApiMs}ms | candidates API=${row.candidatesApiMs}ms\n`,
    );
  }

  console.log("--- Razorpay API states ---");
  const razorpay = await testRazorpayStates();
  for (const r of razorpay) {
    console.log(`  [${r.step}] HTTP ${r.status} (${r.elapsedMs}ms) — ${r.detail}`);
  }

  console.log("\n--- Mobile viewport captures ---");
  const mobile = await captureMobileScreenshots();
  if (!mobile.ok) {
    console.log(`  SKIP: ${mobile.error}`);
  } else {
    for (const s of mobile.shots) {
      console.log(
        `  ${s.name}: ${s.filePath} | overflow=${s.metrics.hasHorizontalOverflow} width=${s.metrics.clientWidth}`,
      );
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    perfCompany: PERF_COMPANY.name,
    performance: perfResults,
    razorpay,
    mobile,
  };

  await mkdir(OUT_DIR, { recursive: true });
  const reportPath = path.join(OUT_DIR, "qa-performance-payments-mobile.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written: ${reportPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
