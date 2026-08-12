/**
 * Login failure behaviour: API + UI error handling.
 * Run: node scripts/test-login-failure.mjs
 * Optional live API check: LOGIN_TEST_BASE_URL=http://localhost:3001
 */

import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.LOGIN_TEST_BASE_URL ?? "http://localhost:3001";

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

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
}

function readSource(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function testUiSourceChecks() {
  const sharedLogin = readSource("src/components/auth/admin-portal-login.tsx");
  const companyLogin = readSource("src/app/company-login/page.tsx");
  const masterLogin = readSource("src/app/master-login/page.tsx");

  test("shared admin login renders error state", () => {
    assert(/const \[error, setError\] = useState\(""\)/.test(sharedLogin), "missing error state");
    assert(/setError\(/.test(sharedLogin), "missing setError calls");
    assert(/text-red-600/.test(sharedLogin), "missing visible error styling");
    assert(/Email and password are required\./.test(sharedLogin), "missing client-side empty-field message");
    assert(/Unable to sign in\./.test(sharedLogin), "missing API fallback error message");
  });

  test("company login page uses shared admin portal login", () => {
    assert(/AdminPortalLogin/.test(companyLogin), "missing shared login component");
    assert(/\/api\/company-auth\/login/.test(companyLogin), "missing company login endpoint");
  });

  test("master login page uses shared admin portal login", () => {
    assert(/AdminPortalLogin/.test(masterLogin), "missing shared login component");
    assert(/\/api\/master\/auth\/login/.test(masterLogin), "missing master login endpoint");
    assert(/adminEmail/.test(masterLogin), "missing admin email field name");
    assert(/passcode/.test(masterLogin), "missing passcode field name");
  });
}

async function postJson(urlPath, body) {
  const response = await fetch(`${BASE_URL}${urlPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return { status: response.status, payload };
}

async function testLiveApiChecks() {
  await testAsync("company wrong passcode returns 401 with clear message", async () => {
    const { status, payload } = await postJson("/api/company-auth/login", {
      companyEmail: "admin@uhired.com",
      passcode: "definitely-wrong-passcode",
    });
    assert(status === 401, `expected 401, got ${status}`);
    assert(payload.error === "Invalid company credentials.", `unexpected error: ${payload.error}`);
  });

  await testAsync("company unknown email returns same generic auth error", async () => {
    const { status, payload } = await postJson("/api/company-auth/login", {
      companyEmail: "unknown@example.com",
      passcode: "admin123",
    });
    assert(status === 401, `expected 401, got ${status}`);
    assert(payload.error === "Invalid company credentials.", `unexpected error: ${payload.error}`);
  });

  await testAsync("master wrong key returns 401 with clear message", async () => {
    const { status, payload } = await postJson("/api/master/auth/login", {
      masterKey: "definitely-wrong-key",
    });
    assert(status === 401, `expected 401, got ${status}`);
    assert(payload.error === "Invalid Master Admin key.", `unexpected error: ${payload.error}`);
  });

  await testAsync("master wrong email/password returns 401 with clear message", async () => {
    const { status, payload } = await postJson("/api/master/auth/login", {
      adminEmail: "wrong@example.com",
      passcode: "definitely-wrong-passcode",
    });
    assert(status === 401, `expected 401, got ${status}`);
    assert(
      payload.error === "Invalid master admin credentials." ||
        payload.error === "Master admin credentials are not configured.",
      `unexpected error: ${payload.error}`,
    );
  });
}

async function main() {
  console.log("Login failure behaviour tests\n");
  testUiSourceChecks();

  try {
    console.log(`\nLive API checks (${BASE_URL})\n`);
    await testLiveApiChecks();
  } catch (error) {
    if (error?.cause?.code === "ECONNREFUSED" || error?.message?.includes("fetch failed")) {
      console.log(`\n  (skipped live API checks — server not reachable at ${BASE_URL})`);
    } else {
      throw error;
    }
  }

  console.log("\nAll login failure behaviour tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
