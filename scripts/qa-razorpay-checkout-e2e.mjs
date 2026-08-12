/**
 * E2E: Razorpay test checkout on /practice (requires dev server + test keys).
 * Run: node --env-file=.env scripts/qa-razorpay-checkout-e2e.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.env.QA_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "docs", "qa-artifacts", new Date().toISOString().slice(0, 10));

async function main() {
  const playwright = await import("playwright");
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await playwright.chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const log = [];

  const email = `razorpay-e2e-${Date.now()}@example.com`;
  await page.goto(`${BASE}/practice`, { waitUntil: "networkidle", timeout: 60_000 });

  await page.fill('input[name="candidateName"]', "E2E Razorpay Tester");
  await page.fill('input[name="email"]', email);
  await page.screenshot({ path: path.join(OUT_DIR, "razorpay-01-practice-form.png"), fullPage: true });

  const payButton = page.getByRole("button", { name: /Pay & Start Session/i });
  await payButton.click();

  // Razorpay modal — wait for iframe
  const frame = page.frameLocator('iframe[src*="razorpay"], iframe.razorpay-checkout-frame').first();
  try {
    await frame.locator('input[name="contact"], input[type="tel"], input[placeholder*="phone" i]').first().waitFor({
      timeout: 30_000,
    });
    await page.screenshot({ path: path.join(OUT_DIR, "razorpay-02-checkout-open.png") });

    // Card payment tab if needed
    const cardTab = frame.getByText(/card/i).first();
    if (await cardTab.isVisible().catch(() => false)) await cardTab.click();

    await frame.locator('input[name="card[number]"], input[placeholder*="card" i]').first().fill("4111 1111 1111 1111");
    await frame.locator('input[name="card[expiry]"], input[placeholder*="MM" i]').first().fill("12 / 30");
    await frame.locator('input[name="card[cvv]"], input[placeholder*="CVV" i]').first().fill("123");

    const payNow = frame.getByRole("button", { name: /pay|continue|submit/i }).first();
    await payNow.click();

    await page.waitForURL(/\/interview\//, { timeout: 90_000 });
    const finalUrl = page.url();
    await page.screenshot({ path: path.join(OUT_DIR, "razorpay-03-after-payment.png"), fullPage: true });

    log.push({ step: "Checkout success", ok: true, finalUrl, detail: "Redirected to interview room after payment" });
  } catch (error) {
    await page.screenshot({ path: path.join(OUT_DIR, "razorpay-error.png"), fullPage: true });
    const bodyText = await page.locator("body").innerText().catch(() => "");
    log.push({
      step: "Checkout",
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      pageSnippet: bodyText.slice(0, 500),
    });
  }

  await browser.close();
  const reportPath = path.join(OUT_DIR, "razorpay-e2e-report.json");
  await writeFile(reportPath, JSON.stringify({ baseUrl: BASE, email, log }, null, 2));
  console.log(JSON.stringify(log, null, 2));
  console.log(`Report: ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
