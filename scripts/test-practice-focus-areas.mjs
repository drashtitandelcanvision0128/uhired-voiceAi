import assert from "node:assert/strict";
import {
  CUSTOM_FOCUS_AREA_TOPIC,
  getPracticePreviewContent,
  PRACTICE_FOCUS_AREAS,
} from "../src/lib/practice-focus-areas.ts";

console.log("Practice focus areas tests\n");

assert.equal(
  PRACTICE_FOCUS_AREAS.length,
  10,
  `expected 10 focus areas, got ${PRACTICE_FOCUS_AREAS.length}`,
);

const domains = PRACTICE_FOCUS_AREAS.map((area) => area.domain);
const requiredDomains = [
  "Software Engineering",
  "Data Science & Analytics",
  "UI/UX & Design",
  "Product Management",
  "Project Management",
  "Sales & Business Development",
  "Business Analyst",
  "Marketing",
  "Human Resources",
  "Finance & Accounting",
];

for (const domain of requiredDomains) {
  assert.ok(domains.includes(domain), `missing focus area: ${domain}`);
}

assert.equal(new Set(domains).size, domains.length, "focus area domains must be unique");

for (const area of PRACTICE_FOCUS_AREAS) {
  assert.ok(area.domain.trim().length > 0, "domain must not be empty");
  assert.ok(area.topic.trim().length > 0, `topic must not be empty for ${area.domain}`);
  assert.ok(
    area.sampleQuestion.trim().length > 20,
    `sample question must be meaningful for ${area.domain}`,
  );
  assert.ok(
    area.sampleFeedback.trim().length > 20,
    `sample feedback must be meaningful for ${area.domain}`,
  );
}

assert.ok(
  CUSTOM_FOCUS_AREA_TOPIC.includes("Tailored"),
  "custom focus area topic should describe tailored interviews",
);

const softwarePreview = getPracticePreviewContent("Software Engineering");
assert.equal(softwarePreview.domain, "Software Engineering");
assert.ok(softwarePreview.sampleQuestion.includes("design"));

const customPreview = getPracticePreviewContent("", "DevOps Engineer");
assert.equal(customPreview.domain, "DevOps Engineer");
assert.ok(customPreview.sampleQuestion.length > 20);

console.log("  ✓ practice focus areas include engineering, data, design, marketing, HR, and finance");
console.log("  ✓ all focus areas have unique domains, descriptions, and sample content");
console.log("  ✓ custom focus area topic and preview helpers are defined");
console.log("\nAll practice focus area tests passed.");
