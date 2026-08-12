/**
 * Browser: invite form submit (replaces legacy Generate Requirement Code).
 */
import { chromium } from "playwright";

const BASE = (process.env.ADMIN_QA_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const responses = [];

  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("/api/admin/requirements/invite-candidates")) {
      let body = {};
      try {
        body = await res.json();
      } catch {
        /* ignore */
      }
      responses.push({ status: res.status(), body });
    }
  });

  await page.goto(`${BASE}/company-login`);
  await page.fill('input[name="companyName"]', "Uhired");
  await page.fill('input[name="companyDomain"]', "uhired.com");
  await page.fill('input[name="companyEmail"]', "admin@uhired.com");
  await page.fill('input[name="passcode"]', "admin123");
  await page.getByRole("button", { name: /Continue to Admin Portal/i }).click();
  await page.waitForURL("**/admin**");

  await page.getByRole("button", { name: "Invite Candidates" }).click();
  await page.waitForTimeout(800);

  const sendBtn = page.getByRole("button", { name: /Send Interview Invites/i });
  console.log(`Send Interview Invites visible: ${await sendBtn.isVisible()}`);

  await page.getByRole("button", { name: "Manual emails" }).click();

  await page.locator('textarea[name="jobDescription"]').fill(
    "QA verification role requiring automated testing skills and attention to detail.",
  );
  await page.locator('input[name="positionTitle"]').fill("QA Engineer");

  const skillInput = page.locator('input[placeholder="Add skill"]');
  await skillInput.fill("Testing");
  await page.getByRole("button", { name: "Add +" }).click();

  await page
    .locator('textarea[placeholder*="candidate1@company.com"]')
    .fill(`qa-browser-${Date.now()}@example.com`);

  await sendBtn.click();
  await page.waitForTimeout(8000);

  const last = responses[responses.length - 1];
  if (last) {
    console.log(`Invite API HTTP status: ${last.status}`);
    console.log(`Invite API error field: ${last.body?.error ?? "(none)"}`);
    console.log(`Invite API summary: ${JSON.stringify(last.body?.summary ?? {})}`);
  } else {
    console.log("No invite API response captured");
  }

  const errorBanner = page.locator('.text-red-700, [class*="red"]').filter({ hasText: /unauthorized/i });
  console.log(`Unauthorized shown in UI: ${await errorBanner.isVisible().catch(() => false)}`);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
