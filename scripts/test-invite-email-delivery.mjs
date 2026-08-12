/**
 * Diagnose interview invite email delivery (SMTP vs SES).
 * Run: npx tsx --env-file=.env scripts/test-invite-email-delivery.mjs
 * Optional: TEST_EMAIL=pandadiya6@gmail.com STAGING_BASE=https://staging.uhired.in
 */

const testEmail = process.env.TEST_EMAIL?.trim() || `qa-invite-${Date.now()}@gmail.com`;
const stagingBase = (process.env.STAGING_BASE || "https://staging.uhired.in").replace(/\/$/, "");

async function loadEmailLibs() {
  const mode = await import("../src/lib/smtp-delivery-mode.ts");
  const email = await import("../src/lib/email.ts");
  return { mode, email };
}

async function testLocalConfig() {
  console.log("\n=== Local env diagnosis ===");
  const { mode, email } = await loadEmailLibs();

  const smtpHost = process.env.SMTP_HOST?.trim() || "(unset)";
  const smtpPort = process.env.SMTP_PORT?.trim() || "(unset)";
  const deliveryMode = mode.getSmtpDeliveryMode();
  const provider = mode.resolveEmailProvider();
  const configured = email.isEmailConfigured();

  console.log(`SMTP_HOST=${smtpHost}`);
  console.log(`SMTP_PORT=${smtpPort}`);
  console.log(`NODE_ENV=${process.env.NODE_ENV || "development"}`);
  console.log(`smtpDeliveryMode=${deliveryMode}`);
  console.log(`resolvedEmailProvider=${provider}`);
  console.log(`isEmailConfigured=${configured}`);
  console.log(`hasAwsSesCredentials=${mode.hasAwsSesCredentials()}`);

  if (
    process.env.NODE_ENV === "production" &&
    provider === "smtp" &&
    deliveryMode === "capture"
  ) {
    console.log("BLOCKED: production + capture SMTP with no SES fallback");
    return { ok: false, reason: "capture_smtp_on_production" };
  }

  console.log(`\nAttempting send to ${testEmail} via ${provider}...`);
  try {
    const result = await email.sendInterviewInviteEmail({
      to: testEmail,
      companyName: "Uhired QA",
      roleTitle: "Email Delivery Test",
      accessCode: "TESTCODE123",
      interviewUrl: "https://uhired.in/candidate?code=TESTCODE123",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    console.log("Send result:", JSON.stringify(result));
    if (result.provider === "smtp" && result.smtpDeliveryMode === "capture") {
      console.log("NOTE: Message accepted by capture SMTP only — not delivered to real inbox.");
      return { ok: true, delivered: false, result };
    }
    console.log("NOTE: Provider reports successful handoff to live delivery.");
    return { ok: true, delivered: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Send FAILED:", message);
    return { ok: false, reason: message };
  }
}

async function testStagingInviteApi() {
  console.log(`\n=== Staging API test @ ${stagingBase} ===`);

  const loginRes = await fetch(`${stagingBase}/api/company-auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyName: "Uhired",
      companyDomain: "uhired.com",
      companyEmail: "admin@uhired.com",
      passcode: "admin123",
    }),
  });
  const loginData = await loginRes.json().catch(() => ({}));
  const setCookie = loginRes.headers.getSetCookie?.() ?? loginRes.headers.get("set-cookie");
  const cookie = Array.isArray(setCookie)
    ? setCookie.map((c) => c.split(";")[0]).join("; ")
    : setCookie
      ? setCookie.split(";")[0]
      : "";

  console.log(`Login: HTTP ${loginRes.status} ok=${loginRes.ok}`);
  if (!loginRes.ok || !cookie) {
    console.log("Cannot test staging invite API — login failed:", loginData?.error ?? loginData);
    return { ok: false, reason: "staging_login_failed" };
  }

  const inviteRes = await fetch(`${stagingBase}/api/admin/requirements/invite-candidates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      source: "manual",
      emails: [testEmail],
      requirement: {
        positionTitle: "Email Delivery QA",
        domain: "Email Delivery QA",
        topic: "Automated email delivery verification",
        durationMin: 15,
        jobDescription: "Testing whether interview invite emails reach real inboxes.",
        keySkills: ["Testing"],
        maxOptionalQuestions: 0,
      },
    }),
  });
  const inviteData = await inviteRes.json().catch(() => ({}));

  console.log(`Invite API: HTTP ${inviteRes.status}`);
  if (inviteData.error) {
    console.log(`Error: ${inviteData.error}`);
  }
  if (inviteData.summary) {
    console.log(`Summary: ${JSON.stringify(inviteData.summary)}`);
  }
  if (inviteData.invites?.length) {
    for (const row of inviteData.invites) {
      console.log(`  ${row.email}: status=${row.status} — ${row.deliveryMessage}`);
    }
  }

  return { ok: inviteRes.ok, status: inviteRes.status, data: inviteData };
}

async function main() {
  console.log("Interview invite email delivery test");
  console.log(`Test recipient: ${testEmail}`);

  const local = await testLocalConfig();
  const staging = await testStagingInviteApi();

  console.log("\n=== Conclusion ===");
  if (local.result?.provider === "smtp" && local.result?.smtpDeliveryMode === "capture") {
    console.log("- Local/staging SMTP is capture-only (Mailpit). Real inboxes will NOT receive mail.");
  }
  if (local.result?.provider === "ses") {
    console.log("- SES was used for send attempt.");
  }
  if (!local.ok) {
    console.log(`- Local send failed: ${local.reason}`);
  }
  if (staging.ok) {
    const row = staging.data?.invites?.[0];
    if (row?.status === "sent") {
      console.log("- Staging API reports SENT — verify inbox (and spam) for the test email.");
    } else {
      console.log(`- Staging API result status: ${row?.status ?? "unknown"}`);
    }
  } else {
    console.log(`- Staging API failed (HTTP ${staging.status ?? "?"}): ${staging.data?.error ?? staging.reason}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
