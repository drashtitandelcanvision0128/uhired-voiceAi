/**
 * Generates browser-downloadable SRS files in public/downloads/
 * Usage: node scripts/generate-srs-downloads.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mdPath = path.join(root, "docs", "Uhired-SRS-Complete.md");
const downloadsDir = path.join(root, "public", "downloads");
const desktopDir = path.join(process.env.USERPROFILE || "", "Desktop", "Uhired-SRS");

fs.mkdirSync(downloadsDir, { recursive: true });
fs.mkdirSync(desktopDir, { recursive: true });

const md = fs.readFileSync(mdPath, "utf8");

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineHtml(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function mdToHtmlBody(mdText) {
  const lines = mdText.split(/\r?\n/);
  const parts = [];
  let i = 0;
  let inCode = false;
  let codeBuf = [];
  let tableRows = [];

  function flushTable() {
    if (tableRows.length < 2) {
      for (const r of tableRows) parts.push(`<p>${inlineHtml(r)}</p>`);
      tableRows = [];
      return;
    }
    const headers = tableRows[0]
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    const rows = tableRows.slice(2).map((r) =>
      r
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim()),
    );
    let html = '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;margin:12px 0;">';
    html += "<thead><tr>" + headers.map((h) => `<th style="background:#1d3557;color:#fff;">${inlineHtml(h)}</th>`).join("") + "</tr></thead><tbody>";
    for (const row of rows) {
      html += "<tr>" + row.map((c) => `<td>${inlineHtml(c)}</td>`).join("") + "</tr>";
    }
    html += "</tbody></table>";
    parts.push(html);
    tableRows = [];
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCode) {
        parts.push(`<pre style="background:#f1f5f9;padding:12px;font-family:Consolas,monospace;font-size:11pt;white-space:pre-wrap;">${escapeHtml(codeBuf.join("\n"))}</pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        if (tableRows.length) flushTable();
        inCode = true;
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      i++;
      continue;
    }

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      if (!/^\|[\s\-:|]+\|$/.test(trimmed)) tableRows.push(trimmed);
      i++;
      continue;
    }
    if (tableRows.length) flushTable();

    if (trimmed === "[PAGE_BREAK]") {
      parts.push('<div style="page-break-before:always;"></div>');
      i++;
      continue;
    }
    if (trimmed === "---") {
      parts.push("<hr/>");
      i++;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      parts.push(`<h1 style="color:#1d3557;text-align:center;">${inlineHtml(trimmed.slice(2))}</h1>`);
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      parts.push(`<h2 style="color:#1d3557;border-bottom:2px solid #e2e8f0;padding-bottom:4px;">${inlineHtml(trimmed.slice(3))}</h2>`);
      i++;
      continue;
    }
    if (trimmed.startsWith("### ")) {
      parts.push(`<h3 style="color:#334155;">${inlineHtml(trimmed.slice(4))}</h3>`);
      i++;
      continue;
    }
    if (trimmed.startsWith("#### ")) {
      parts.push(`<h4>${inlineHtml(trimmed.slice(5))}</h4>`);
      i++;
      continue;
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      parts.push(`<ul><li>${inlineHtml(trimmed.slice(2))}</li></ul>`);
      i++;
      continue;
    }
    if (trimmed === "") {
      i++;
      continue;
    }
    parts.push(`<p style="margin:6px 0;line-height:1.6;">${inlineHtml(trimmed)}</p>`);
    i++;
  }
  if (tableRows.length) flushTable();
  return parts.join("\n");
}

const bodyHtml = mdToHtmlBody(md);

const htmlPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Uhired SRS — Download</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; background: #f8fafc; color: #1e293b; }
    .toolbar { background: #1d3557; color: #fff; padding: 16px 24px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; position: sticky; top: 0; z-index: 10; }
    .toolbar h1 { margin: 0; font-size: 1.1rem; flex: 1; }
    .btn { display: inline-block; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem; cursor: pointer; border: none; }
    .btn-primary { background: #0055D4; color: #fff; }
    .btn-secondary { background: #fff; color: #1d3557; }
    .btn:hover { opacity: 0.9; }
    .content { max-width: 900px; margin: 0 auto; padding: 32px 24px 64px; background: #fff; min-height: 100vh; }
    @media print { .toolbar { display: none; } .content { max-width: 100%; padding: 0; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>Uhired SRS — Software Requirements Specification</h1>
    <a class="btn btn-primary" href="/downloads/Uhired-SRS-Complete.doc" download="Uhired-SRS-Complete.doc">Download Word (.doc)</a>
    <a class="btn btn-secondary" href="/downloads/Uhired-SRS-Complete.docx" download="Uhired-SRS-Complete.docx">Download .docx</a>
    <button class="btn btn-secondary" onclick="window.print()">Print / Save PDF</button>
  </div>
  <div class="content">
    ${bodyHtml}
  </div>
</body>
</html>`;

const wordDoc = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8"/>
<meta name="ProgId" content="Word.Document"/>
<meta name="Generator" content="Uhired SRS Generator"/>
<!--[if gte mso 9]><xml>
<w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument>
</xml><![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; margin: 1in; }
  h1 { color: #1d3557; font-size: 22pt; text-align: center; }
  h2 { color: #1d3557; font-size: 16pt; border-bottom: 1pt solid #ccc; padding-bottom: 4pt; page-break-before: auto; }
  h3 { color: #334155; font-size: 13pt; }
  h4 { font-size: 12pt; }
  table { border-collapse: collapse; width: 100%; margin: 10pt 0; }
  th { background: #1d3557; color: #fff; padding: 6pt; border: 1pt solid #999; }
  td { padding: 6pt; border: 1pt solid #999; vertical-align: top; }
  pre { background: #f1f5f9; padding: 10pt; font-family: Consolas, monospace; font-size: 9pt; white-space: pre-wrap; }
  p { margin: 6pt 0; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

// Write files
fs.writeFileSync(path.join(downloadsDir, "index.html"), htmlPage, "utf8");
fs.writeFileSync(path.join(downloadsDir, "Uhired-SRS-Complete.html"), htmlPage, "utf8");
fs.writeFileSync(path.join(downloadsDir, "Uhired-SRS-Complete.doc"), wordDoc, "utf8");

// Regenerate docx
execSync("node scripts/generate-srs-docx.mjs", { cwd: root, stdio: "inherit" });
fs.copyFileSync(
  path.join(root, "docs", "Uhired-SRS-Complete.docx"),
  path.join(downloadsDir, "Uhired-SRS-Complete.docx"),
);

// Copy to Desktop folder for easy access
for (const name of ["Uhired-SRS-Complete.doc", "Uhired-SRS-Complete.docx", "Uhired-SRS-Complete.html"]) {
  fs.copyFileSync(path.join(downloadsDir, name), path.join(desktopDir, name));
}
fs.copyFileSync(mdPath, path.join(desktopDir, "Uhired-SRS-Complete.md"));

console.log("");
console.log("=== SRS Download Files Ready ===");
console.log("");
console.log("Browser (dev server running):");
console.log("  http://localhost:3000/downloads/");
console.log("");
console.log("Desktop folder:");
console.log(`  ${desktopDir}`);
console.log("");
console.log("Project folder:");
console.log(`  ${downloadsDir}`);
console.log("");
