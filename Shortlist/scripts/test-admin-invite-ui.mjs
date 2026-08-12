/**
 * Smoke test: admin invite UI should not duplicate legacy "Generate Requirement Code".
 * Run: node scripts/test-admin-invite-ui.mjs
 */

import fs from "node:fs";
import path from "node:path";

const adminPagePath = path.join(process.cwd(), "src/app/admin/page.tsx");
const source = fs.readFileSync(adminPagePath, "utf8");

function count(label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (source.match(new RegExp(escaped, "g")) ?? []).length;
}

const legacyLabel = "Generate Requirement Code";
const legacySection = "Requirement Control";
const sidebarLabel = "Invite Candidates";
const primaryAction = "Send Interview Invites";

const legacyCount = count(legacyLabel);
const legacySectionCount = count(legacySection);
const sidebarCount = count(sidebarLabel);
const primaryCount = count(primaryAction);

console.log("Admin invite UI source checks\n");
console.log(`  ${legacyLabel}: ${legacyCount} (expected 0)`);
console.log(`  ${legacySection}: ${legacySectionCount} (expected 0 in UI copy)`);
console.log(`  ${sidebarLabel}: ${sidebarCount} (expected 1)`);
console.log(`  ${primaryAction}: ${primaryCount} (expected 1)`);

const hasScrollToDraft = /function scrollToDraft\(\)/.test(source);
const usesDraftScrollToken = /setDraftScrollToken/.test(source);
const scrollSetsOverview = /setActiveSection\("overview"\)/.test(
  source.slice(source.indexOf("function scrollToDraft"), source.indexOf("function scrollToDraft") + 400),
);
console.log(`  scrollToDraft navigates to overview: ${scrollSetsOverview}`);
console.log(`  scrollToDraft uses post-render scroll token: ${usesDraftScrollToken}`);

let failed = false;
if (legacyCount !== 0) {
  console.error(`\nFAIL: "${legacyLabel}" still appears ${legacyCount} time(s).`);
  failed = true;
}
if (sidebarCount !== 1) {
  console.error(`\nFAIL: expected exactly one "${sidebarLabel}" sidebar button, found ${sidebarCount}.`);
  failed = true;
}
if (primaryCount !== 1) {
  console.error(`\nFAIL: expected exactly one "${primaryAction}" button, found ${primaryCount}.`);
  failed = true;
}
if (!hasScrollToDraft || !scrollSetsOverview || !usesDraftScrollToken) {
  console.error("\nFAIL: scrollToDraft must switch to overview and scroll after render.");
  failed = true;
}

if (failed) process.exit(1);
console.log("\nAll admin invite UI source checks passed.");
