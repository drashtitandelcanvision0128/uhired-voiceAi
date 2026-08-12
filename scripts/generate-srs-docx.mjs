/**
 * Generates docs/Uhired-SRS-Complete.docx from docs/Uhired-SRS-Complete.md
 * Usage: node scripts/generate-srs-docx.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageBreak,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const mdPath = path.join(root, "docs", "Uhired-SRS-Complete.md");
const outPath = path.join(root, "docs", "Uhired-SRS-Complete.docx");

const md = fs.readFileSync(mdPath, "utf8");
const lines = md.split(/\r?\n/);

function parseTableRow(line) {
  return line
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
}

function isTableSeparator(line) {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function makeTable(headers, rows) {
  const colCount = headers.length;
  const colWidth = Math.floor(9360 / colCount);
  const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };

  const headerRow = new TableRow({
    children: headers.map(
      (h) =>
        new TableCell({
          borders,
          width: { size: colWidth, type: WidthType.DXA },
          shading: { fill: "1D3557" },
          children: [
            new Paragraph({
              children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 20 })],
            }),
          ],
        }),
    ),
  });

  const dataRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              borders,
              width: { size: colWidth, type: WidthType.DXA },
              children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20 })] })],
            }),
        ),
      }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

function parseInline(text) {
  const runs = [];
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: 22 }));
    } else if (part.startsWith("`") && part.endsWith("`")) {
      runs.push(new TextRun({ text: part.slice(1, -1), font: "Consolas", size: 20 }));
    } else {
      runs.push(new TextRun({ text: part, size: 22 }));
    }
  }
  return runs.length ? runs : [new TextRun({ text, size: 22 })];
}

const children = [];
let i = 0;
let tableBuffer = [];

function flushTable() {
  if (tableBuffer.length < 2) {
    for (const line of tableBuffer) {
      children.push(new Paragraph({ children: parseInline(line) }));
    }
    tableBuffer = [];
    return;
  }
  const headers = parseTableRow(tableBuffer[0]);
  const rows = tableBuffer.slice(2).map(parseTableRow);
  children.push(makeTable(headers, rows));
  tableBuffer = [];
}

while (i < lines.length) {
  const line = lines[i];
  const trimmed = line.trim();

  if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
    if (!isTableSeparator(trimmed)) tableBuffer.push(trimmed);
    i++;
    continue;
  }

  if (tableBuffer.length) {
    flushTable();
  }

  if (trimmed === "---") {
    children.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
    i++;
    continue;
  }

  if (trimmed === "[PAGE_BREAK]") {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    i++;
    continue;
  }

  if (trimmed.startsWith("# ")) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        children: [new TextRun({ text: trimmed.slice(2), bold: true, size: 36, color: "1D3557" })],
      }),
    );
    i++;
    continue;
  }

  if (trimmed.startsWith("## ")) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 120 },
        children: [new TextRun({ text: trimmed.slice(3), bold: true, size: 28, color: "1D3557" })],
      }),
    );
    i++;
    continue;
  }

  if (trimmed.startsWith("### ")) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: trimmed.slice(4), bold: true, size: 24, color: "334155" })],
      }),
    );
    i++;
    continue;
  }

  if (trimmed.startsWith("#### ")) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 160, after: 60 },
        children: [new TextRun({ text: trimmed.slice(5), bold: true, size: 22 })],
      }),
    );
    i++;
    continue;
  }

  if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
    children.push(
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60 },
        children: parseInline(trimmed.slice(2)),
      }),
    );
    i++;
    continue;
  }

  if (trimmed.startsWith("```")) {
    const codeLines = [];
    i++;
    while (i < lines.length && !lines[i].trim().startsWith("```")) {
      codeLines.push(lines[i]);
      i++;
    }
    i++;
    children.push(
      new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [
          new TextRun({
            text: codeLines.join("\n"),
            font: "Consolas",
            size: 18,
            color: "1E293B",
          }),
        ],
      }),
    );
    continue;
  }

  if (trimmed === "") {
    i++;
    continue;
  }

  children.push(
    new Paragraph({
      spacing: { after: 80 },
      children: parseInline(trimmed),
    }),
  );
  i++;
}

if (tableBuffer.length) flushTable();

const doc = new Document({
  creator: "Uhired Engineering",
  title: "Uhired SRS — Complete Specification",
  description: "Software Requirements Specification for Uhired AI Interview Platform",
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1440, right: 1080, bottom: 1440, left: 1080 },
        },
      },
      children,
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outPath, buffer);
console.log(`Generated: ${outPath}`);
