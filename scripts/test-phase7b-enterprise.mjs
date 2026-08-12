/**
 * Phase 7b enterprise checks (RBAC, field encryption).
 * Usage: npm run test:enterprise
 */
import assert from "node:assert/strict";
import {
  assertCompanyPermission,
  CompanyPermissionError,
  hasCompanyPermission,
  normalizeMemberRole,
} from "../src/lib/company-rbac.ts";
import {
  decryptField,
  encryptField,
  isFieldEncryptionEnabled,
  protectEmail,
  revealEmail,
} from "../src/lib/field-encryption.ts";

function testRbacMatrix() {
  assert.equal(hasCompanyPermission("ADMIN", "team:manage"), true);
  assert.equal(hasCompanyPermission("VIEWER", "team:manage"), false);
  assert.equal(hasCompanyPermission("RECRUITER", "invite:send"), true);
  assert.equal(hasCompanyPermission("VIEWER", "candidates:write"), false);
  assert.throws(() => assertCompanyPermission("VIEWER", "settings:write"), CompanyPermissionError);
  assert.equal(normalizeMemberRole("hiring_manager"), "HIRING_MANAGER");
  assert.equal(normalizeMemberRole("invalid"), null);
  console.log("✓ RBAC permission matrix");
}

function testFieldEncryptionRoundtrip() {
  const plain = "candidate@example.com";
  if (!isFieldEncryptionEnabled()) {
    assert.equal(protectEmail(plain), plain);
    assert.equal(revealEmail(plain), plain);
    console.log("✓ field encryption skipped (FIELD_ENCRYPTION_KEY not set)");
    return;
  }
  const encrypted = encryptField(plain);
  assert.ok(encrypted?.startsWith("enc:v1:"));
  assert.equal(decryptField(encrypted), plain);
  assert.equal(revealEmail(protectEmail(plain)), plain);
  console.log("✓ field encryption roundtrip");
}

testRbacMatrix();
testFieldEncryptionRoundtrip();
console.log("\nAll Phase 7b unit checks passed.");
