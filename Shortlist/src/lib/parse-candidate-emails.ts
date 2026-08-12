const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function dedupeEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of emails) {
    const email = normalizeEmail(raw);
    if (!email || !isValidEmail(email) || seen.has(email)) continue;
    seen.add(email);
    result.push(email);
  }
  return result;
}

const EMAIL_COLUMN_NAMES = new Set([
  "email",
  "e-mail",
  "e mail",
  "email address",
  "emailaddress",
  "e-mail address",
  "candidate email",
  "candidate_email",
  "contact",
  "contact email",
  "mail",
]);

function normalizeColumnName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
}

export function normalizeSpreadsheetCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.text === "string" && obj.text.trim()) {
      return obj.text.trim();
    }
    const hyperlink = obj.Target ?? obj.hyperlink ?? obj.l;
    if (typeof hyperlink === "string") {
      return hyperlink.replace(/^mailto:/i, "").trim();
    }
  }
  return String(value).trim();
}

export function findEmailColumnIndex(headerRow: unknown[]): number {
  for (let index = 0; index < headerRow.length; index += 1) {
    const normalized = normalizeColumnName(headerRow[index]);
    if (EMAIL_COLUMN_NAMES.has(normalized)) {
      return index;
    }
  }
  return -1;
}

function findBestEmailColumnInRows(rows: unknown[][], startRow: number): number {
  const counts = new Map<number, number>();
  for (let rowIndex = startRow; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const value = normalizeSpreadsheetCell(row[colIndex]);
      if (value && isValidEmail(value)) {
        counts.set(colIndex, (counts.get(colIndex) ?? 0) + 1);
      }
    }
  }

  let bestIndex = -1;
  let bestCount = 0;
  for (const [index, count] of counts) {
    if (count > bestCount) {
      bestIndex = index;
      bestCount = count;
    }
  }
  return bestIndex;
}

function rowHasOtherData(row: unknown[], emailColumnIndex: number): boolean {
  for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
    if (colIndex === emailColumnIndex) continue;
    if (normalizeSpreadsheetCell(row[colIndex])) return true;
  }
  return false;
}

export function extractEmailsFromSheetRows(rows: unknown[][]): {
  emails: string[];
  invalidRows: number[];
  duplicateRows: number[];
  emptyRows: number[];
  columnIndex: number;
} {
  if (!rows.length) {
    return { emails: [], invalidRows: [], duplicateRows: [], emptyRows: [], columnIndex: -1 };
  }

  const headerRow = rows[0] ?? [];
  let columnIndex = findEmailColumnIndex(headerRow);
  let startRow = 1;

  if (columnIndex < 0) {
    columnIndex = findBestEmailColumnInRows(rows, 0);
    if (columnIndex >= 0) {
      const firstCell = normalizeSpreadsheetCell(rows[0]?.[columnIndex]);
      if (isValidEmail(firstCell)) {
        startRow = 0;
      } else if (rows.length > 1) {
        columnIndex = findBestEmailColumnInRows(rows, 1);
        startRow = 1;
      }
    }
  }

  if (columnIndex < 0) {
    return { emails: [], invalidRows: [], duplicateRows: [], emptyRows: [], columnIndex: -1 };
  }

  const emails: string[] = [];
  const invalidRows: number[] = [];
  const duplicateRows: number[] = [];
  const emptyRows: number[] = [];
  const seen = new Set<string>();

  for (let rowIndex = startRow; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const cell = normalizeSpreadsheetCell(row[columnIndex]);
    if (!cell) {
      if (rowHasOtherData(row, columnIndex)) {
        emptyRows.push(rowIndex + 1);
      }
      continue;
    }
    if (!isValidEmail(cell)) {
      invalidRows.push(rowIndex + 1);
      continue;
    }
    const normalized = normalizeEmail(cell);
    if (seen.has(normalized)) {
      duplicateRows.push(rowIndex + 1);
      continue;
    }
    seen.add(normalized);
    emails.push(normalized);
  }

  return {
    emails,
    invalidRows,
    duplicateRows,
    emptyRows,
    columnIndex,
  };
}

export function parseManualEmailInput(text: string): string[] {
  const lines = text
    .split(/[\n,;]+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return dedupeEmails(lines);
}

export const MANUAL_EMAIL_LIMIT = 20;
export const EXCEL_EMAIL_LIMIT = 50;

export function validateEmailBatch(
  emails: string[],
  source: "manual" | "excel",
): { ok: true; emails: string[] } | { ok: false; error: string } {
  const limit = source === "manual" ? MANUAL_EMAIL_LIMIT : EXCEL_EMAIL_LIMIT;
  if (!emails.length) {
    return { ok: false, error: "Add at least one valid candidate email." };
  }
  if (emails.length > limit) {
    return {
      ok: false,
      error: `You can invite up to ${limit} candidates via ${source === "manual" ? "manual entry" : "Excel upload"}.`,
    };
  }
  return { ok: true, emails };
}
