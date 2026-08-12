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

async function testLogin(label, body) {
  const res = await fetch(`${baseUrl}/api/master/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`${label}: HTTP ${res.status} -> ${text}`);
  return { res, text };
}

async function main() {
  await testLogin("Wrong password", {
    adminEmail: email,
    passcode: "wrong-password",
    trustDevice: false,
  });

  const success = await testLogin("Correct env password", {
    adminEmail: email,
    passcode: password,
    trustDevice: true,
  });

  if (success.res.status !== 200) {
    console.error("Login test failed.");
    process.exit(1);
  }

  const cookie = success.res.headers.get("set-cookie");
  if (!cookie) {
    console.error("Login succeeded but no session cookie was set.");
    process.exit(1);
  }

  const sessionCookie = cookie.split(";")[0];
  const profileRes = await fetch(`${baseUrl}/api/master/profile`, {
    headers: { cookie: sessionCookie },
  });
  const profileText = await profileRes.text();
  console.log(`Profile with session: HTTP ${profileRes.status} -> ${profileText}`);

  if (profileRes.status !== 200) {
    console.error("Profile test failed.");
    process.exit(1);
  }

  console.log("All master login tests passed.");
}

main().catch((error) => {
  console.error("Test failed:", error.message);
  process.exit(1);
});
