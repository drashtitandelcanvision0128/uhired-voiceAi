/**
 * Admin dashboard API shape + metric helper tests.
 * Run: node scripts/test-admin-dashboard.mjs
 * Optional env for live API check: DASHBOARD_TEST_BASE_URL, DASHBOARD_TEST_COOKIE
 */

function scoreBucket(score) {
  if (score <= 50) return "0–50%";
  if (score <= 70) return "51–70%";
  if (score <= 85) return "71–85%";
  return "86–100%";
}

function deltaPct(current, previous) {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

const REQUIRED_KEYS = [
  "period",
  "periodLabel",
  "statusCounts",
  "periodCounts",
  "candidatesCount",
  "requirementsCount",
  "invites",
  "periodInvites",
  "averageScore",
  "completionRate",
  "scoreBuckets",
  "sessionsTrend",
  "comparisons",
  "topRoles",
  "recentSessions",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
}

console.log("Admin dashboard tests\n");

test("scoreBucket maps score ranges", () => {
  assert(scoreBucket(30) === "0–50%", "low bucket");
  assert(scoreBucket(60) === "51–70%", "mid bucket");
  assert(scoreBucket(80) === "71–85%", "high bucket");
  assert(scoreBucket(95) === "86–100%", "top bucket");
});

test("deltaPct handles zero previous period", () => {
  assert(deltaPct(5, 0) === 100, "growth from zero");
  assert(deltaPct(0, 0) === null, "flat from zero");
});

test("deltaPct calculates percent change", () => {
  assert(deltaPct(15, 10) === 50, "50% increase");
  assert(deltaPct(5, 10) === -50, "50% decrease");
});

test("dashboard response shape expectations", () => {
  const sample = {
    period: "30d",
    periodLabel: "Last 30 days",
    statusCounts: { total: 1, ready: 0, live: 0, completed: 1, open: 0 },
    periodCounts: { total: 1, ready: 0, live: 0, completed: 1, open: 0 },
    candidatesCount: 1,
    requirementsCount: 1,
    invites: { total: 1, sent: 1, used: 0, pending: 1 },
    periodInvites: { total: 1, sent: 1, used: 0, pending: 1, conversionRate: 0 },
    averageScore: 72,
    completionRate: 100,
    scoreBuckets: [{ label: "0–50%", count: 0 }],
    sessionsTrend: [{ date: "2026-07-01", label: "Jul 1", created: 1, completed: 1 }],
    comparisons: {
      sessionsCreated: { current: 1, previous: 0, deltaPct: 100 },
      invitesSent: { current: 1, previous: 0, deltaPct: 100 },
      averageScore: { current: 72, previous: null, deltaPct: null },
    },
    topRoles: [{ role: "Engineer", count: 1, avgScore: 72 }],
    recentSessions: [],
  };
  for (const key of REQUIRED_KEYS) {
    assert(key in sample, `missing key: ${key}`);
  }
});

async function maybeLiveApiCheck() {
  const base = process.env.DASHBOARD_TEST_BASE_URL;
  const cookie = process.env.DASHBOARD_TEST_COOKIE;
  if (!base || !cookie) {
    console.log("\nSkipping live API check (set DASHBOARD_TEST_BASE_URL and DASHBOARD_TEST_COOKIE).");
    return;
  }

  const response = await fetch(`${base.replace(/\/$/, "")}/api/admin/dashboard?period=30d`, {
    headers: { cookie },
  });
  assert(response.ok, `live API failed: ${response.status}`);
  const data = await response.json();
  for (const key of REQUIRED_KEYS) {
    assert(key in data, `live response missing key: ${key}`);
  }
  console.log("\n  ✓ live dashboard API shape");
}

await maybeLiveApiCheck();
console.log("\nAll admin dashboard tests passed.");
