/**
 * Tests for key skill expansion and question role-scope filtering.
 * Run: npx tsx scripts/test-key-skill-expansion.mjs
 */
import assert from "node:assert/strict";
import { expandKeySkills } from "../src/lib/key-skill-expansion.ts";
import { filterQuestionsToRoleScope } from "../src/lib/question-role-scope.ts";

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    throw error;
  }
}

console.log("Key skill expansion tests\n");

test("expands MERN Stack into concrete technologies", () => {
  const expanded = expandKeySkills(["MERN Stack"]);
  assert.ok(expanded.includes("MongoDB"));
  assert.ok(expanded.includes("React"));
  assert.ok(expanded.includes("Node.js"));
  assert.ok(expanded.includes("Express.js"));
});

test("preserves non-compound skills", () => {
  const expanded = expandKeySkills(["Python", "AWS"]);
  assert.deepEqual(expanded, ["Python", "AWS"]);
});

test("filters automation questions for web developer roles", () => {
  const questions = [
    { prompt: "How do you design REST APIs in Express?", expectedAnswer: null, gradingRubric: null, difficulty: "medium" },
    { prompt: "Describe your experience with N8N workflow automation.", expectedAnswer: null, gradingRubric: null, difficulty: "medium" },
  ];
  const filtered = filterQuestionsToRoleScope(
    questions,
    ["MongoDB", "React", "Node.js"],
    "Web Developer",
    "Build MERN applications.",
  );
  assert.equal(filtered.length, 1);
  assert.match(filtered[0].prompt, /REST APIs/i);
});

test("keeps automation questions when role requires automation", () => {
  const questions = [
    { prompt: "How do you build N8N workflows?", expectedAnswer: null, gradingRubric: null, difficulty: "medium" },
  ];
  const filtered = filterQuestionsToRoleScope(
    questions,
    ["N8N", "automation"],
    "Automation Engineer",
    "Workflow automation with N8N.",
  );
  assert.equal(filtered.length, 1);
});

console.log("\nAll key skill expansion tests passed.");
