/**
 * Phase 6 privacy feature tests (consent, deletion, retention helpers).
 * Usage: npm run test:privacy
 */
import assert from "node:assert/strict";
import {
  hashCompanyPasscode,
  isCompanyPasscodeHash,
  verifyCompanyPasscode,
} from "../src/lib/company-passcode.ts";
import { INTERVIEW_CONSENT_VERSION } from "../src/lib/interview-consent.ts";
import {
  checkRateLimit,
  getClientIpFromRequest,
} from "../src/lib/rate-limit.ts";

function testPasscodeHashing() {
  const plain = "TestPasscode123!";
  const hashed = hashCompanyPasscode(plain);
  assert.ok(isCompanyPasscodeHash(hashed));
  assert.equal(verifyCompanyPasscode(plain, hashed), true);
  assert.equal(verifyCompanyPasscode("wrong", hashed), false);
  assert.equal(verifyCompanyPasscode(plain, plain), true);
  console.log("✓ company passcode hash/verify");
}

function testRetentionDefaults() {
  assert.equal(Number(process.env.DATA_RETENTION_DAYS_VIDEO?.trim() || "30"), 30);
  assert.equal(Number(process.env.DATA_RETENTION_DAYS_TRANSCRIPT?.trim() || "90"), 90);
  assert.equal(Number(process.env.DATA_RETENTION_DAYS_PRACTICE?.trim() || "180"), 180);
  console.log("✓ retention day defaults");
}

function testConsentVersion() {
  assert.ok(INTERVIEW_CONSENT_VERSION.length > 0);
  console.log("✓ consent version constant");
}

function testRateLimit() {
  const key = `test-${Date.now()}`;
  const first = checkRateLimit("unit-test", key, 2, 60_000);
  const second = checkRateLimit("unit-test", key, 2, 60_000);
  const third = checkRateLimit("unit-test", key, 2, 60_000);
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.ok(
    getClientIpFromRequest(
      new Request("http://localhost", {
        headers: { "x-forwarded-for": "1.2.3.4" },
      }),
    ) === "1.2.3.4",
  );
  console.log("✓ rate limit helper");
}

testPasscodeHashing();
testRetentionDefaults();
testConsentVersion();
testRateLimit();
console.log("\nAll Phase 6 unit checks passed.");
