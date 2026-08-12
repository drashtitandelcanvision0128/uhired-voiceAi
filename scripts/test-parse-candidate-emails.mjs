import assert from "node:assert/strict";
import { extractEmailsFromSheetRows } from "../src/lib/parse-candidate-emails.ts";

function test(name, rows, expected) {
  const result = extractEmailsFromSheetRows(rows);
  assert.equal(result.emails.length, expected.emailCount, `${name}: email count`);
  if (expected.invalidRows) {
    assert.deepEqual(result.invalidRows, expected.invalidRows, `${name}: invalidRows`);
  }
  if (expected.duplicateRows) {
    assert.deepEqual(result.duplicateRows, expected.duplicateRows, `${name}: duplicateRows`);
  }
  if (expected.emptyRows) {
    assert.deepEqual(result.emptyRows, expected.emptyRows, `${name}: emptyRows`);
  }
  console.log(`ok - ${name}`);
}

test("no header row keeps first email", [
  ["alice@test.com"],
  ["bob@test.com"],
  ["carol@test.com"],
], { emailCount: 3 });

test("standard header row", [
  ["email"],
  ["alice@test.com"],
  ["bob@test.com"],
  ["carol@test.com"],
], { emailCount: 3 });

test("duplicate emails are reported", [
  ["email"],
  ["alice@test.com"],
  ["alice@test.com"],
  ["bob@test.com"],
], { emailCount: 2, duplicateRows: [3] });

test("empty email cell with other data is reported", [
  ["email", "name"],
  ["alice@test.com", "Alice"],
  ["", "Bob"],
  ["carol@test.com", "Carol"],
], { emailCount: 2, emptyRows: [3] });

test("name and contact columns without email header", [
  ["Name", "Contact"],
  ["Alice", "alice@test.com"],
  ["Bob", "bob@test.com"],
], { emailCount: 2 });

test("invalid email row is reported", [
  ["email"],
  ["alice@test.com"],
  ["not-an-email"],
  ["bob@test.com"],
], { emailCount: 2, invalidRows: [3] });

console.log("All parse-candidate-emails tests passed.");
