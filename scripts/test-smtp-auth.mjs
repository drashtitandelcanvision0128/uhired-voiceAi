import nodemailer from "nodemailer";

async function tryServer(host, port, user, pass) {
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
    tls: { minVersion: "TLSv1.2" },
  });
  try {
    await transport.verify();
    console.log(`OK: ${host}:${port} as ${user}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL: ${host}:${port} — ${message}`);
    return false;
  }
}

const user = process.env.SMTP_USER?.trim() ?? "";
const pass = process.env.SMTP_PASS?.trim() || process.env.SMTP_PASSWORD?.trim() || "";
const configuredHost = process.env.SMTP_HOST?.trim() || "smtpout.secureserver.net";
const configuredPort = Number(process.env.SMTP_PORT?.trim() || "465");

console.log("=== SMTP auth check ===");
console.log(`SMTP_USER=${user || "(unset)"}`);
console.log(`SMTP_PASS=${pass ? "(set)" : "(missing — add SMTP_PASS or SMTP_PASSWORD in .env)"}`);
console.log(`SMTP_HOST=${configuredHost}`);
console.log(`SMTP_PORT=${configuredPort}`);
console.log("");

if (!user || !pass) {
  console.log("BLOCKED: Set SMTP_USER and SMTP_PASS in .env before testing.");
  process.exit(1);
}

let ok = await tryServer(configuredHost, configuredPort, user, pass);

if (!ok && configuredHost !== "smtpout.secureserver.net") {
  console.log("\nFallback: trying smtpout.secureserver.net:465 (GoDaddy Titan)...");
  ok = await tryServer("smtpout.secureserver.net", 465, user, pass);
}

console.log("\n=== What this means ===");
if (ok) {
  console.log("Login works. Restart npm run dev and send invites again.");
  const testEmail = process.env.TEST_EMAIL?.trim();
  if (testEmail) {
    console.log(`\nSending test invite to ${testEmail}...`);
    const { sendInterviewInviteEmail } = await import("../src/lib/email.ts");
    const result = await sendInterviewInviteEmail({
      to: testEmail,
      companyName: "Uhired",
      roleTitle: "SMTP Test",
      accessCode: "TESTNO123",
      interviewUrl: "https://uhired.in/candidate?code=TESTNO123",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    console.log("Test invite sent:", JSON.stringify(result));
    console.log("Check inbox and spam folder.");
  }
} else {
  console.log("535 = SMTP login rejected. Mailbox may exist in webmail but app cannot send yet.");
  console.log("");
  console.log("Fix checklist (no-reply@uhired.in is already in Titan webmail):");
  console.log("  1. Titan webmail → Settings (gear icon) → Enable Titan on Other Apps");
  console.log("  2. Turn OFF two-factor authentication on this mailbox");
  console.log("  3. GoDaddy → Email & Office → uhired.in → no-reply → Reset Password");
  console.log("  4. Put the NEW password in .env as SMTP_PASS and SMTP_PASSWORD");
  console.log("  5. Restart npm run dev, run this script again");
  console.log("");
  console.log("PowerShell test with email send:");
  console.log("  $env:TEST_EMAIL=\"your@gmail.com\"; npx tsx --env-file=.env scripts/test-smtp-auth.mjs");
}
