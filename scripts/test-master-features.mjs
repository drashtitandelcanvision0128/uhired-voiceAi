import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const email = process.env.MASTER_ADMIN_EMAIL || "master@uhired.com";
const password = process.env.MASTER_ADMIN_PASSWORD || "master@123";
const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";

async function login() {
  const res = await fetch(`${baseUrl}/api/master/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adminEmail: email, passcode: password, trustDevice: true }),
  });
  const text = await res.text();
  if (res.status !== 200) {
    throw new Error(`Login failed HTTP ${res.status}: ${text}`);
  }
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("No session cookie");
  return cookie.split(";")[0];
}

async function getJson(cookie, path, label) {
  const res = await fetch(`${baseUrl}${path}`, { headers: { cookie } });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  console.log(`${label}: HTTP ${res.status}`);
  if (res.status !== 200) {
    console.log(`  -> ${text.slice(0, 200)}`);
    throw new Error(`${label} failed`);
  }
  return json;
}

async function main() {
  console.log("=== Master feature tests ===\n");
  const cookie = await login();
  console.log("Login: OK\n");

  const companySessions = await getJson(cookie, "/api/master/company-sessions?page=1&pageSize=5", "Company sessions API");
  console.log(`  -> ${companySessions.rows?.length ?? 0} rows, total ${companySessions.pagination?.total ?? 0}`);

  const practiceSessions = await getJson(
    cookie,
    "/api/master/practice-sessions?page=1&pageSize=5&status=LIVE",
    "Practice sessions filter API",
  );
  console.log(`  -> ${practiceSessions.rows?.length ?? 0} LIVE rows`);

  const companies = await getJson(cookie, "/api/master/companies?page=1&pageSize=5&search=test", "Companies search API");
  console.log(`  -> ${companies.companies?.length ?? 0} companies`);

  const analytics = await getJson(
    cookie,
    "/api/master/user-analytics?page=1&pageSize=10&type=PRACTICE",
    "User analytics pagination API",
  );
  console.log(
    `  -> page ${analytics.pagination?.page}, ${analytics.users?.length ?? 0} users, total ${analytics.pagination?.total ?? 0}`,
  );

  const logs = await getJson(cookie, "/api/master/logs?page=1&pageSize=5", "Audit logs API (DB)");
  console.log(`  -> ${logs.logs?.length ?? 0} log rows, total ${logs.pagination?.total ?? 0}`);

  const overview = await getJson(cookie, "/api/master/overview", "Overview API (dashboard alias)");
  console.log(`  -> metrics keys: ${Object.keys(overview.metrics ?? {}).join(", ")}`);

  const payments = await getJson(cookie, "/api/master/payments?page=1&pageSize=5", "Payments API");
  const payment = payments.payments?.[0];
  console.log(`  -> ${payments.payments?.length ?? 0} payments`);

  if (payment) {
    const action =
      payment.status === "CREATED"
        ? "verify"
        : payment.status === "FAILED"
          ? "retry"
          : payment.status === "VERIFIED"
            ? null
            : null;

    if (action === "verify") {
      const patchRes = await fetch(`${baseUrl}/api/master/payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ action: "verify" }),
      });
      const patchText = await patchRes.text();
      console.log(`Payment verify test: HTTP ${patchRes.status} -> ${patchText.slice(0, 120)}`);
      if (patchRes.status !== 200) throw new Error("Payment verify failed");
    } else {
      console.log(`Payment action test: skipped (first payment status=${payment.status})`);
    }
  } else {
    console.log("Payment action test: skipped (no payments)");
  }

  const search = await getJson(cookie, "/api/master/search?q=test", "Global search deep links");
  const hrefs = (search.results ?? []).slice(0, 3).map((r) => r.href);
  console.log(`  -> sample hrefs: ${hrefs.join(" | ")}`);

  console.log("\n=== All master feature tests passed ===");
}

main().catch((error) => {
  console.error("\nTest failed:", error.message);
  process.exit(1);
});
