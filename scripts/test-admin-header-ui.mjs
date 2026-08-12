/**
 * Browser smoke: bell + profile menu clickability on /admin
 * Run: npx playwright install chromium && node scripts/test-admin-header-ui.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.ADMIN_QA_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
const LOGIN = {
  companyName: "Uhired",
  companyDomain: "uhired.com",
  companyEmail: "admin@uhired.com",
  passcode: "admin123",
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const network = [];

  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/api/admin/") || url.includes("/api/company-auth/")) {
      network.push({ method: req.method(), url });
    }
  });

  await page.goto(`${BASE}/company-login`);
  await page.fill('input[name="companyName"]', LOGIN.companyName);
  await page.fill('input[name="companyDomain"]', LOGIN.companyDomain);
  await page.fill('input[name="companyEmail"]', LOGIN.companyEmail);
  await page.fill('input[name="passcode"]', LOGIN.passcode);
  await page.getByRole("button", { name: /Continue to Admin Portal/i }).click();
  await page.waitForURL("**/admin**", { timeout: 15000 });

  const sidebarInvite = page.getByRole("button", { name: "Invite Candidates" });
  const legacyGenerate = page.getByRole("button", { name: /Generate Requirement Code/i });
  const loadRefresh = page.getByRole("button", { name: /Load \/ refresh data/i });
  const sendInvites = page.getByRole("button", { name: /Send Interview Invites/i });

  console.log("--- Duplicate button check (rendered DOM) ---");
  console.log(`  Invite Candidates buttons: ${await sidebarInvite.count()}`);
  console.log(`  Generate Requirement Code buttons: ${await legacyGenerate.count()}`);
  console.log(`  Send Interview Invites buttons: ${await sendInvites.count()}`);

  console.log("\n--- Sidebar Invite Candidates navigation ---");
  await page.getByRole("button", { name: "Dashboard" }).click();
  await sidebarInvite.click();
  await page.waitForTimeout(500);
  const overviewVisible = await page.getByText("Interview Requirements").isVisible();
  console.log(`  Navigated to overview form: ${overviewVisible}`);

  console.log("\n--- Load / refresh data network calls ---");
  const before = network.length;
  await loadRefresh.click();
  await page.waitForTimeout(3000);
  const newCalls = network.slice(before);
  const apiCalls = newCalls.filter((c) => c.url.includes("/api/"));
  console.log(`  API calls triggered: ${apiCalls.length}`);
  for (const c of apiCalls) console.log(`    ${c.method} ${c.url.replace(BASE, "")}`);

  console.log("\n--- Bell + profile menu ---");
  const bell = page.getByRole("button", { name: "Notifications" });
  await bell.click();
  const notifOpen = await page.getByText("Live activity from your portal").isVisible();
  console.log(`  Bell opens notifications panel: ${notifOpen}`);

  const profileBtn = page.locator("header button").filter({ hasText: "Uhired" }).first();
  await profileBtn.click();
  const profileOpen = await page.getByRole("button", { name: /Edit profile/i }).isVisible().catch(() => false)
    || await page.getByText("Company admin").first().isVisible();
  console.log(`  Profile menu opens: ${profileOpen}`);

  console.log("\n--- Analytics dashboard section ---");
  await page.getByRole("button", { name: "Dashboard" }).click();
  await page.waitForTimeout(2000);
  const analyticsLoaded = await page.getByText("Analytics Dashboard").isVisible();
  const loadingGone = !(await page.getByText("Loading analytics…").isVisible().catch(() => false));
  console.log(`  Analytics Dashboard visible: ${analyticsLoaded}`);
  console.log(`  Finished loading (not stuck on spinner): ${loadingGone}`);

  await browser.close();
  console.log("\nBrowser smoke complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
