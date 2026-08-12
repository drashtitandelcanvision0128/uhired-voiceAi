/**
 * Strips Hindi text from SRS and regenerates all download files.
 * Usage: node scripts/clean-srs-english.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mdPath = path.join(root, "docs", "Uhired-SRS-Complete.md");

let text = fs.readFileSync(mdPath, "utf8");

// Remove lines that are only Hindi subtitles
text = text
  .split("\n")
  .filter((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ") && /[\u0900-\u097F]/.test(trimmed) && !trimmed.includes("Uhired")) return false;
    if (/^[\u0900-\u097F\s—\-–।]+$/.test(trimmed)) return false;
    if (trimmed.startsWith("**विज़न:**")) return false;
    return true;
  })
  .join("\n");

// Remove Hindi from headings: "## Title / Hindi" -> "## Title"
text = text.replace(/^(#{1,4}\s+.+?)\s*\/\s*[\u0900-\u097F][^\n]*/gm, "$1");

// Remove Hindi from TOC numbered items: "1. Foo (hindi)" -> "1. Foo"
text = text.replace(/^(\d+\.\s+.+?)\s*\([\u0900-\u097F][^)]*\)/gm, "$1");

// Remove Hindi column from definitions table header and rows
text = text.replace(/\| Term \| Hindi \| Definition \|/g, "| Term | Definition |");
text = text.replace(/\|[-]+\|[-]+\|[-]+\|/g, (match, offset) => {
  const before = text.slice(Math.max(0, offset - 200), offset);
  if (before.includes("| Term | Definition |")) return "|------|------------|";
  return match;
});
text = text.replace(
  /^\| ([^|]+) \| [\u0900-\u097F][^|]* \| (.+) \|$/gm,
  "| $1 | $2 |",
);

// Remove Hindi column from stakeholders table
text = text.replace(/\| Actor \| Hindi \| Description/g, "| Actor | Description");
text = text.replace(
  /^\| ([^|]+) \| [\u0900-\u097F][^|]* \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm,
  "| $1 | $2 | $3 | $4 |",
);

// Remove Hindi column from timeline overview table
text = text.replace(/\| Week \| Focus Area \| Hindi \| Key/g, "| Week | Focus Area | Key");
text = text.replace(
  /^\| (Week \d[^|]+) \| ([^|]+) \| [\u0900-\u097F][^|]* \| ([^|]+) \|$/gm,
  "| $1 | $2 | $3 |",
);

// Fix end of document
text = text.replace(/\*\*End of Document \/ [^*]+\*\*/g, "**End of Document**");

// Remove any remaining Devanagari characters
text = text.replace(/[\u0900-\u097F]+/g, "");
// Clean up double spaces and empty parens
text = text.replace(/\(\s*\)/g, "");
text = text.replace(/  +/g, " ");
text = text.replace(/\n{3,}/g, "\n\n");

// Fix table of contents header
text = text.replace("## Table of Contents ", "## Table of Contents\n");

fs.writeFileSync(mdPath, text, "utf8");
console.log("Cleaned SRS markdown to English-only.");

execSync("node scripts/generate-srs-downloads.mjs", { cwd: root, stdio: "inherit" });
