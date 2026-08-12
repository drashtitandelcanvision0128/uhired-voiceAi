import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { EmailVerificationResult } from "@/lib/email-verification-shared";
import { verificationStatusLabel } from "@/lib/email-verification-shared";
import { pdfTextSafeForStandardFont } from "@/lib/pdf-text-safe";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const ROW_H = 22;
const HEADER_H = 28;

const navy = rgb(32 / 255, 56 / 255, 84 / 255);
const slate = rgb(71 / 255, 85 / 255, 105 / 255);
const green = rgb(22 / 255, 101 / 255, 52 / 255);
const red = rgb(185 / 255, 28 / 255, 28 / 255);
const line = rgb(226 / 255, 232 / 255, 240 / 255);
const white = rgb(1, 1, 1);
const teal = rgb(0 / 255, 106 / 255, 98 / 255);

function safe(text: string): string {
  return pdfTextSafeForStandardFont(text);
}

export type CandidateVerificationPdfInput = {
  companyName: string;
  roleTitle?: string;
  source: "excel" | "manual";
  fileName?: string | null;
  results: EmailVerificationResult[];
};

export async function buildCandidateVerificationPdfBytes(
  input: CandidateVerificationPdfInput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const draw = (text: string, x: number, size: number, bold = false, color = navy) => {
    page.drawText(safe(text), {
      x,
      y,
      size,
      font: bold ? fontBold : font,
      color,
    });
  };

  const newPageIfNeeded = (needed = ROW_H) => {
    if (y - needed < MARGIN + 30) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      drawTableHeader();
    }
  };

  const drawTableHeader = () => {
    page.drawRectangle({
      x: MARGIN,
      y: y - HEADER_H + 8,
      width: PAGE_W - MARGIN * 2,
      height: HEADER_H,
      color: teal,
    });
    draw("#", MARGIN + 8, 10, true, white);
    draw("Email", MARGIN + 36, 10, true, white);
    draw("Status", MARGIN + 300, 10, true, white);
    draw("Details", MARGIN + 390, 10, true, white);
    y -= HEADER_H + 4;
  };

  draw("Uhired", MARGIN, 11, true, teal);
  draw("Candidate Email Verification Report", MARGIN, 24, true);
  y -= 40;

  draw(`Company: ${input.companyName}`, MARGIN, 10);
  y -= 16;
  if (input.roleTitle?.trim()) {
    draw(`Role: ${input.roleTitle.trim()}`, MARGIN, 10);
    y -= 16;
  }
  draw(`Source: ${input.source === "excel" ? "Excel upload" : "Manual entry"}`, MARGIN, 10);
  y -= 16;
  if (input.fileName) {
    draw(`File: ${input.fileName}`, MARGIN, 10);
    y -= 16;
  }
  draw(`Generated: ${new Date().toLocaleString("en-IN")}`, MARGIN, 10, false, slate);
  y -= 22;

  const verified = input.results.filter((row) => row.valid).length;
  const invalid = input.results.length - verified;
  page.drawRectangle({
    x: MARGIN,
    y: y - 34,
    width: PAGE_W - MARGIN * 2,
    height: 34,
    color: rgb(248 / 255, 250 / 255, 252 / 255),
    borderColor: line,
    borderWidth: 1,
  });
  draw(`Total: ${input.results.length}`, MARGIN + 12, 10, true);
  draw(`Verified: ${verified}`, MARGIN + 120, 10, false, green);
  draw(`Incorrect: ${invalid}`, MARGIN + 220, 10, false, red);
  y -= 48;

  drawTableHeader();

  input.results.forEach((row, index) => {
    newPageIfNeeded();
    const rowTop = y;
    if (index % 2 === 0) {
      page.drawRectangle({
        x: MARGIN,
        y: rowTop - ROW_H + 6,
        width: PAGE_W - MARGIN * 2,
        height: ROW_H,
        color: rgb(248 / 255, 250 / 255, 252 / 255),
      });
    }
    draw(String(index + 1), MARGIN + 8, 9);
    draw(row.email, MARGIN + 36, 9, false, navy);
    const statusColor = row.valid ? green : red;
    draw(verificationStatusLabel(row.status), MARGIN + 300, 9, true, statusColor);
    draw(row.message, MARGIN + 390, 8, false, slate);
    y -= ROW_H;
  });

  const pages = doc.getPages();
  pages.forEach((pdfPage, pageIndex) => {
    pdfPage.drawText(safe(`Page ${pageIndex + 1} of ${pages.length}`), {
      x: PAGE_W - MARGIN - 70,
      y: 24,
      size: 8,
      font,
      color: slate,
    });
  });

  return doc.save();
}
