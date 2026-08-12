/**
 * pdf-lib standard fonts (Helvetica) only support WinAnsi; many Unicode code points throw at draw time.
 * Normalize and restrict to printable ASCII so scorecard summaries (any language/symbols) never crash PDF export.
 */
export function pdfTextSafeForStandardFont(text: string): string {
  const withNewlines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return withNewlines
    .split("\n")
    .map((line) =>
      line
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-")
        .replace(/[\u2018\u2019\u00B4\u0060]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\u2026/g, "...")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/[^\x20-\x7E]/g, ""),
    )
    .join("\n");
}
