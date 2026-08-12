import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFDocument as PDFDocType,
  type PDFPage,
  type PDFFont,
  type RGB,
} from "pdf-lib";
import type { ScorecardSharePublicPayload } from "@/lib/scorecard-share-payload";
import { pdfTextSafeForStandardFont } from "@/lib/pdf-text-safe";
import { buildPdfSkillRows, getRoleProfileLabel } from "@/lib/scorecard-share-role-content";
import {
  HOLISTIC_OVERALL_FORMULA,
  OVERALL_WITH_ANSWER_GRADING_NOTE,
} from "@/lib/scorecard-scoring-formula";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

/** Uhired scorecard UI palette (matches mobile scorecard theme) */
const brandNavy = rgb(32 / 255, 56 / 255, 84 / 255); // #203854
const brandNavyDark = rgb(15 / 255, 23 / 255, 42 / 255); // #0f172a
const navy = rgb(26 / 255, 51 / 255, 82 / 255);
const accent = rgb(0 / 255, 106 / 255, 98 / 255); // #006a62 teal
const accentBright = rgb(38 / 255, 166 / 255, 154 / 255); // badge highlight
const accentSoft = rgb(209 / 255, 250 / 255, 245 / 255);
const slate = rgb(71 / 255, 85 / 255, 105 / 255);
const slateLight = rgb(148 / 255, 163 / 255, 184 / 255);
const bgGray = rgb(248 / 255, 250 / 255, 252 / 255);
const white = rgb(1, 1, 1);
const amber = rgb(217 / 255, 119 / 255, 6 / 255);
const starEmpty = rgb(210 / 255, 216 / 255, 226 / 255);
const borderSoft = rgb(226 / 255, 232 / 255, 240 / 255);
const formulaBg = rgb(238 / 255, 247 / 255, 255 / 255); // #eef7ff
const formulaText = rgb(30 / 255, 64 / 255, 175 / 255);
const blueSoft = rgb(238 / 255, 247 / 255, 255 / 255);
const amberSoft = rgb(255 / 255, 249 / 255, 230 / 255); // #fff9e6
const lavenderSoft = rgb(243 / 255, 244 / 255, 249 / 255); // #f3f4f9
const greenSoft = rgb(220 / 255, 252 / 255, 231 / 255);
const confidenceBlue = rgb(147 / 255, 197 / 255, 253 / 255); // light blue slice

type PdfCtx = { page: PDFPage; font: PDFFont; fontBold: PDFFont };

function safe(text: string): string {
  return pdfTextSafeForStandardFont(text);
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if (!w) continue;
    const next = current ? `${current} ${w}` : w;
    if (next.length <= maxChars) current = next;
    else {
      if (current) lines.push(current);
      if (w.length > maxChars) {
        for (let i = 0; i < w.length; i += maxChars) lines.push(w.slice(i, i + maxChars));
        current = "";
      } else current = w;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function drawText(
  ctx: PdfCtx,
  text: string,
  x: number,
  y: number,
  opts?: { size?: number; bold?: boolean; color?: RGB; maxWidth?: number },
) {
  ctx.page.drawText(safe(text), {
    x,
    y,
    size: opts?.size ?? 9,
    font: opts?.bold ? ctx.fontBold : ctx.font,
    color: opts?.color ?? navy,
    maxWidth: opts?.maxWidth,
  });
}

function drawCard(
  ctx: PdfCtx,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = white,
  borderColor = borderSoft,
) {
  ctx.page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: fill,
    borderColor,
    borderWidth: 0.75,
  });
}

function drawSectionLabel(ctx: PdfCtx, label: string, x: number, y: number, accentColor = accent) {
  ctx.page.drawRectangle({ x, y: y - 1, width: 3, height: 10, color: accentColor });
  drawText(ctx, label, x + 8, y, { size: 7.5, bold: true, color: brandNavy });
}

function drawProgressBar(ctx: PdfCtx, x: number, y: number, w: number, pct: number, color: RGB) {
  const h = 5;
  ctx.page.drawRectangle({ x, y, width: w, height: h, color: rgb(230 / 255, 234 / 255, 240 / 255) });
  const fillW = Math.max(0, Math.min(w, (w * pct) / 100));
  if (fillW > 0) {
    ctx.page.drawRectangle({ x, y, width: fillW, height: h, color });
    if (fillW > 3) {
      ctx.page.drawRectangle({
        x: x + fillW - 2,
        y,
        width: 2,
        height: h,
        color: color === accent ? accentBright : color,
      });
    }
  }
}

/** SVG path for star centered at origin (required for pdf-lib drawSvgPath x/y placement). */
function starPathOrigin(outerR: number): string {
  const innerR = outerR * 0.42;
  const parts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outerR : innerR;
    parts.push(`${i === 0 ? "M" : "L"} ${(r * Math.cos(angle)).toFixed(2)} ${(r * Math.sin(angle)).toFixed(2)}`);
  }
  return `${parts.join(" ")} Z`;
}

function drawStarAt(ctx: PdfCtx, cx: number, cy: number, filled: boolean) {
  ctx.page.drawSvgPath(starPathOrigin(5.5), {
    x: cx,
    y: cy,
    color: filled ? accent : starEmpty,
  });
}

function drawStarRating(ctx: PdfCtx, x: number, y: number, rating: number) {
  const step = 14;
  const full = Math.min(5, Math.max(0, Math.round(rating)));

  for (let i = 0; i < 5; i++) {
    const cx = x + i * step + 6;
    const cy = y + 8;
    drawStarAt(ctx, cx, cy, i < full);
  }
}

function drawPieSliceAt(
  ctx: PdfCtx,
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
  color: RGB,
) {
  const sweep = endDeg - startDeg;
  if (sweep <= 0.01) return;

  if (sweep >= 359.99) {
    ctx.page.drawCircle({ x: cx, y: cy, size: r, color });
    return;
  }

  const steps = Math.max(6, Math.ceil(sweep / 8));
  const point = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return `${(r * Math.cos(rad)).toFixed(2)} ${(r * Math.sin(rad)).toFixed(2)}`;
  };

  let path = `M 0 0 L ${point(startDeg)}`;
  for (let i = 1; i <= steps; i++) {
    const deg = startDeg + (sweep * i) / steps;
    path += ` L ${point(deg)}`;
  }
  path += " Z";
  ctx.page.drawSvgPath(path, { x: cx, y: cy, color });
}

type DistributionSlice = { label: string; pct: number; color: RGB };

/** Holistic overall weights: 35% communication, 40% domain, 25% confidence. */
function buildScoreDistributionSlices(): DistributionSlice[] {
  return [
    { label: "Communication", pct: 35, color: brandNavy },
    { label: "Domain Depth", pct: 40, color: accent },
    { label: "Confidence", pct: 25, color: confidenceBlue },
  ];
}

const SCORE_DISTRIBUTION_H = 96;

function drawScoreDistribution(ctx: PdfCtx, yTop: number): number {
  const h = SCORE_DISTRIBUTION_H;
  const y = yTop - h;
  const slices = buildScoreDistributionSlices();

  drawCard(ctx, MARGIN, y, CONTENT_W, h, white);
  drawSectionLabel(ctx, "SCORE DISTRIBUTION", MARGIN + 12, y + h - 12);

  const cx = MARGIN + 58;
  const cy = y + 42;
  const outerR = 34;
  const innerR = 21;

  let angle = -90;
  for (const slice of slices) {
    const sweep = (slice.pct / 100) * 360;
    if (sweep > 0.5) drawPieSliceAt(ctx, cx, cy, outerR, angle, angle + sweep, slice.color);
    angle += sweep;
  }

  ctx.page.drawCircle({ x: cx, y: cy, size: outerR, borderColor: borderSoft, borderWidth: 0.5 });
  ctx.page.drawCircle({ x: cx, y: cy, size: innerR, color: white });

  const pctStr = "100%";
  const pctSize = 11;
  const pctW = ctx.fontBold.widthOfTextAtSize(pctStr, pctSize);
  drawText(ctx, pctStr, cx - pctW / 2, cy + 3, { size: pctSize, bold: true, color: brandNavy });
  const totalStr = "TOTAL";
  const totalSize = 6;
  const totalW = ctx.font.widthOfTextAtSize(totalStr, totalSize);
  drawText(ctx, totalStr, cx - totalW / 2, cy - 7, { size: totalSize, color: slateLight });

  const legendX = MARGIN + 118;
  const legendPctX = MARGIN + CONTENT_W - 52;
  let ly = y + h - 30;
  for (const slice of slices) {
    ctx.page.drawRectangle({ x: legendX, y: ly - 1, width: 8, height: 8, color: slice.color });
    drawText(ctx, slice.label, legendX + 14, ly - 1, { size: 7.5, color: brandNavy });
    drawText(ctx, `${slice.pct}%`, legendPctX, ly - 1, { size: 7.5, bold: true, color: brandNavy });
    ly -= 14;
  }

  return y - 8;
}

type MetricIconType = "document" | "chart" | "people";

type OverviewMetric = {
  title: string;
  value: number;
  accent: RGB;
  iconBg: RGB;
  icon: MetricIconType;
  valueColor: RGB;
};

/** Same dimensions as the admin scorecard after interview (no fabricated resume/percentile). */
function buildInterviewOverviewMetrics(sc: ScorecardSharePublicPayload["scorecard"]): OverviewMetric[] {
  const metrics: OverviewMetric[] = [
    {
      title: "Overall Score",
      value: sc.overallScore,
      accent: accent,
      iconBg: accentSoft,
      icon: "chart",
      valueColor: accent,
    },
    {
      title: "Communication",
      value: sc.communication,
      accent: brandNavy,
      iconBg: blueSoft,
      icon: "document",
      valueColor: brandNavy,
    },
    {
      title: "Domain Depth",
      value: sc.domainDepth,
      accent: accent,
      iconBg: greenSoft,
      icon: "people",
      valueColor: accent,
    },
  ];

  if (sc.accuracyPercent != null) {
    metrics.push({
      title: "Answer Accuracy",
      value: sc.accuracyPercent,
      accent: accent,
      iconBg: accentSoft,
      icon: "document",
      valueColor: accent,
    });
  }

  return metrics;
}

function drawMetricIcon(
  ctx: PdfCtx,
  type: MetricIconType,
  boxX: number,
  boxY: number,
  boxSize: number,
  iconColor: RGB,
  bgColor: RGB,
) {
  ctx.page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxSize,
    height: boxSize,
    color: bgColor,
    borderColor: borderSoft,
    borderWidth: 0.5,
  });
  const cx = boxX + boxSize / 2;
  const cy = boxY + boxSize / 2;

  if (type === "document") {
    ctx.page.drawRectangle({
      x: cx - 5,
      y: cy - 5,
      width: 10,
      height: 12,
      borderColor: iconColor,
      borderWidth: 0.9,
    });
    for (let i = 0; i < 3; i++) {
      ctx.page.drawLine({
        start: { x: cx - 3, y: cy + 1 - i * 3 },
        end: { x: cx + 3, y: cy + 1 - i * 3 },
        thickness: 0.6,
        color: iconColor,
      });
    }
  } else if (type === "chart") {
    ctx.page.drawLine({
      start: { x: cx - 5, y: cy - 4 },
      end: { x: cx - 2, y: cy + 1 },
      thickness: 1.2,
      color: iconColor,
    });
    ctx.page.drawLine({
      start: { x: cx - 2, y: cy + 1 },
      end: { x: cx + 2, y: cy - 2 },
      thickness: 1.2,
      color: iconColor,
    });
    ctx.page.drawLine({
      start: { x: cx + 2, y: cy - 2 },
      end: { x: cx + 5, y: cy + 4 },
      thickness: 1.2,
      color: iconColor,
    });
  } else {
    ctx.page.drawCircle({ x: cx - 3, y: cy + 2, size: 2.2, color: iconColor });
    ctx.page.drawCircle({ x: cx + 3, y: cy + 2, size: 2.2, color: iconColor });
    ctx.page.drawLine({
      start: { x: cx - 5.5, y: cy - 1 },
      end: { x: cx + 5.5, y: cy - 1 },
      thickness: 1,
      color: iconColor,
    });
  }
}

function drawOverallScoreBadge(ctx: PdfCtx, x: number, y: number, w: number, h: number, score: number, brandLabel: string) {
  ctx.page.drawRectangle({ x, y, width: w, height: h, color: accent });
  ctx.page.drawRectangle({ x, y: y + h * 0.42, width: w, height: h * 0.58, color: accentBright });

  drawText(ctx, "OVERALL SCORE", x + 6, y + h - 12, { size: 5.5, bold: true, color: white });

  const scoreStr = String(score);
  const scoreSize = 24;
  const sw = ctx.fontBold.widthOfTextAtSize(scoreStr, scoreSize);
  drawText(ctx, scoreStr, x + (w - sw) / 2, y + h / 2 - 4, {
    size: scoreSize,
    bold: true,
    color: white,
  });

  const tagH = 12;
  const tagW = w - 12;
  const tagX = x + 6;
  const tagY = y + 6;
  ctx.page.drawRectangle({ x: tagX, y: tagY, width: tagW, height: tagH, color: white });
  const label = safe(brandLabel);
  const labelSize = 6;
  const lw = ctx.fontBold.widthOfTextAtSize(label, labelSize);
  drawText(ctx, label, tagX + (tagW - lw) / 2, tagY + 3, {
    size: labelSize,
    bold: true,
    color: accent,
  });
}

function scorecardBrandLabel(companyName: string): string {
  const trimmed = companyName.trim();
  if (!trimmed || /^company$/i.test(trimmed)) return "UnHired";
  if (trimmed.length <= 14) return trimmed;
  return trimmed.slice(0, 12).trim() + "...";
}

function drawHeader(ctx: PdfCtx, payload: ScorecardSharePublicPayload, yTop: number) {
  const h = 92;
  const y = yTop - h;

  ctx.page.drawRectangle({ x: MARGIN, y, width: CONTENT_W, height: h, color: brandNavyDark });
  ctx.page.drawRectangle({ x: MARGIN, y: y + h - 4, width: CONTENT_W, height: 4, color: accent });

  const textX = MARGIN + 14;
  const metaColor = rgb(0.78, 0.86, 0.9);
  const roleLine =
    payload.positionTitle?.trim() || payload.domain?.trim() || payload.topic?.trim() || "";

  drawText(ctx, "UNHIRED · INTERVIEW SCORECARD", textX, y + h - 16, {
    size: 6.5,
    bold: true,
    color: accentBright,
  });

  const candidateLabel = (payload.candidateName?.trim() || "Candidate").toUpperCase();
  drawText(ctx, candidateLabel, textX, y + h - 32, {
    size: 17,
    bold: true,
    color: white,
    maxWidth: CONTENT_W - 100,
  });

  if (roleLine) {
    drawText(ctx, roleLine, textX, y + h - 46, {
      size: 8,
      color: rgb(0.82, 0.9, 0.94),
      maxWidth: CONTENT_W - 100,
    });
  }

  const email = payload.candidateEmail?.trim();
  if (email) {
    drawText(ctx, email, textX, y + h - 58, { size: 7, color: metaColor, maxWidth: CONTENT_W - 100 });
  }

  drawText(ctx, `Interview duration: ${payload.sessionTimeDisplay}`, textX, y + h - 68, {
    size: 7,
    color: metaColor,
  });

  const badgeW = 72;
  const badgeH = 62;
  const badgeX = MARGIN + CONTENT_W - badgeW - 10;
  const badgeY = y + (h - badgeH) / 2;
  drawOverallScoreBadge(
    ctx,
    badgeX,
    badgeY,
    badgeW,
    badgeH,
    payload.scorecard.overallScore,
    scorecardBrandLabel(payload.companyName),
  );

  return y - 12;
}

function drawOverviewCards(ctx: PdfCtx, payload: ScorecardSharePublicPayload, yTop: number) {
  const cards = buildInterviewOverviewMetrics(payload.scorecard);
  const cardH = 76;
  const gap = 8;
  const cardW = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
  const y = yTop - cardH;
  const iconSize = 22;

  cards.forEach((c, i) => {
    const x = MARGIN + i * (cardW + gap);
    drawCard(ctx, x, y, cardW, cardH, white);

    const iconY = y + cardH - iconSize - 14;
    drawMetricIcon(ctx, c.icon, x + 10, iconY, iconSize, c.accent, c.iconBg);

    const valueX = x + 10 + iconSize + 6;
    const valueY = y + cardH - 32;
    drawText(ctx, String(c.value), valueX, valueY, {
      size: cards.length > 4 ? 12 : 14,
      bold: true,
      color: c.valueColor,
    });
    drawText(ctx, "Out of 100", valueX, valueY - 12, { size: 6.5, color: slateLight });

    drawText(ctx, c.title, x + 10, y + 24, {
      size: cards.length > 4 ? 7 : 8,
      bold: true,
      color: brandNavy,
      maxWidth: cardW - 20,
    });
    drawProgressBar(ctx, x + 8, y + 10, cardW - 16, c.value, c.accent);
  });

  const formulaNote =
    payload.scorecard.accuracyPercent != null
      ? `${HOLISTIC_OVERALL_FORMULA}. ${OVERALL_WITH_ANSWER_GRADING_NOTE}`
      : HOLISTIC_OVERALL_FORMULA;
  const noteLines = wrapLines(formulaNote, 90);
  const noteBoxH = noteLines.length * 9 + 14;
  let noteY = y - 10;
  const noteBoxBottom = noteY - noteBoxH;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: noteBoxBottom,
    width: CONTENT_W,
    height: noteBoxH,
    color: formulaBg,
    borderColor: rgb(191 / 255, 219 / 255, 254 / 255),
    borderWidth: 0.5,
  });
  for (const line of noteLines) {
    noteY -= 9;
    drawText(ctx, line, MARGIN + 10, noteY, { size: 6.5, color: formulaText, maxWidth: CONTENT_W - 20 });
  }

  return noteBoxBottom - 12;
}

function drawSkillsTable(ctx: PdfCtx, payload: ScorecardSharePublicPayload, yTop: number) {
  const rows = buildPdfSkillRows(payload);
  const roleProfile = getRoleProfileLabel(payload);
  const sectionTitleH = 24;
  const headerH = 20;
  const rowH = 22;
  const tableH = sectionTitleH + headerH + rows.length * rowH + 8;
  const y = yTop - tableH;
  const tableX = MARGIN + 8;
  const tableW = CONTENT_W - 16;
  const skillW = tableW * 0.55;
  const ratingX = tableX + skillW;

  drawCard(ctx, MARGIN, y, CONTENT_W, tableH);
  drawSectionLabel(ctx, "SKILLS & RATINGS", MARGIN + 12, y + tableH - 12);
  drawText(ctx, `Assessment profile: ${roleProfile}`, MARGIN + 12, y + tableH - 24, {
    size: 6.5,
    color: slateLight,
    maxWidth: CONTENT_W - 24,
  });

  const headerY = y + tableH - sectionTitleH - headerH - 4;
  ctx.page.drawRectangle({ x: tableX, y: headerY, width: tableW, height: headerH, color: brandNavyDark });
  drawText(ctx, "SKILL", tableX + 12, headerY + 6, { size: 8, bold: true, color: white });
  drawText(ctx, "RATING", ratingX + 8, headerY + 6, { size: 8, bold: true, color: white });

  const border = borderSoft;
  const gray = rgb(245 / 255, 247 / 255, 250 / 255);

  const bodyBottom = headerY - rows.length * rowH;
  ctx.page.drawRectangle({
    x: tableX,
    y: bodyBottom,
    width: tableW,
    height: headerH + rows.length * rowH,
    borderColor: border,
    borderWidth: 0.6,
  });

  rows.forEach((row, idx) => {
    const rowY = headerY - (idx + 1) * rowH;
    ctx.page.drawRectangle({
      x: tableX,
      y: rowY,
      width: tableW,
      height: rowH,
      color: idx % 2 === 0 ? white : gray,
    });
    ctx.page.drawLine({
      start: { x: tableX, y: rowY },
      end: { x: tableX + tableW, y: rowY },
      thickness: 0.5,
      color: border,
    });
    ctx.page.drawLine({
      start: { x: ratingX, y: rowY },
      end: { x: ratingX, y: rowY + rowH },
      thickness: 0.5,
      color: border,
    });
    drawText(ctx, row.name, tableX + 10, rowY + 7, { size: 8.5, color: brandNavy });
    drawStarRating(ctx, ratingX + 8, rowY + 1, row.rating);
  });

  return y - 8;
}

const FOOTER_RESERVE = 52;
const MIN_CONTENT_Y = MARGIN + FOOTER_RESERVE;
const SUMMARY_LINE_CHARS = 82;

type SummarySubsection = { title: string; items: string[] | null | undefined };

function measureSummarySectionHeight(sc: ScorecardSharePublicPayload["scorecard"]): number {
  const sectionTitleH = 22;
  const subsectionTitleH = 14;
  const lineH = 9.5;
  const pad = 14;
  let h = sectionTitleH + pad;

  const summary = sc.summary?.trim() || "Assessment completed. Review strengths and improvement areas below.";
  h += wrapLines(summary, SUMMARY_LINE_CHARS).length * lineH + 8;

  const subsections: SummarySubsection[] = [
    { title: "Strengths", items: sc.strengths },
    { title: "Improvement Areas", items: sc.improvements },
    { title: "Evidence Highlights", items: sc.evidence },
  ];

  for (const sub of subsections) {
    const items = sub.items?.filter((item) => item.trim()) ?? [];
    if (!items.length) continue;
    const italic = sub.title === "Evidence Highlights";
    h += subsectionTitleH + 6;
    for (const item of items) {
      const prefix = italic ? `"${item.trim()}"` : `• ${item.trim()}`;
      h += wrapLines(prefix, SUMMARY_LINE_CHARS).length * lineH;
    }
    h += 8;
  }

  return Math.max(h, 56);
}

function ensurePageSpace(
  ctx: PdfCtx,
  doc: PDFDocType,
  yTop: number,
  neededHeight: number,
): number {
  if (yTop - neededHeight >= MIN_CONTENT_Y) return yTop;

  return beginNewContentPage(ctx, doc);
}

function beginNewContentPage(ctx: PdfCtx, doc: PDFDocType): number {
  const page = doc.addPage([PAGE_W, PAGE_H]);
  ctx.page = page;
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: bgGray });
  return PAGE_H - MARGIN;
}

function drawSummarySection(
  ctx: PdfCtx,
  doc: PDFDocType,
  sc: ScorecardSharePublicPayload["scorecard"],
  yTop: number,
): number {
  const sectionH = measureSummarySectionHeight(sc);
  const yTopAdjusted = ensurePageSpace(ctx, doc, yTop, sectionH + 8);
  const y = yTopAdjusted - sectionH;
  const innerX = MARGIN + 12;
  const innerW = CONTENT_W - 24;

  drawCard(ctx, MARGIN, y, CONTENT_W, sectionH);
  drawSectionLabel(ctx, "EXECUTIVE SUMMARY", innerX, y + sectionH - 12);

  let cursorY = y + sectionH - 28;
  const summary = sc.summary?.trim() || "Assessment completed. Review strengths and improvement areas below.";
  for (const line of wrapLines(summary, SUMMARY_LINE_CHARS)) {
    drawText(ctx, line, innerX, cursorY, { size: 8, color: slate, maxWidth: innerW });
    cursorY -= 10;
  }
  cursorY -= 10;

  const subsections: Array<SummarySubsection & { accent: RGB; bg: RGB; italic?: boolean }> = [
    { title: "Strengths", items: sc.strengths, accent: brandNavy, bg: blueSoft },
    { title: "Improvement Areas", items: sc.improvements, accent: amber, bg: amberSoft },
    { title: "Evidence Highlights", items: sc.evidence, accent: slate, bg: lavenderSoft, italic: true },
  ];

  for (const sub of subsections) {
    const items = sub.items?.filter((item) => item.trim()) ?? [];
    if (!items.length) continue;

    let blockH = 16;
    for (const item of items) {
      const prefix = sub.italic ? `"${item.trim()}"` : `• ${item.trim()}`;
      blockH += wrapLines(prefix, SUMMARY_LINE_CHARS).length * 9.5;
    }
    blockH += 10;

    cursorY -= blockH;
    ctx.page.drawRectangle({
      x: innerX,
      y: cursorY,
      width: innerW,
      height: blockH,
      color: sub.bg,
      borderColor: borderSoft,
      borderWidth: 0.5,
    });
    ctx.page.drawRectangle({ x: innerX, y: cursorY, width: 4, height: blockH, color: sub.accent });

    drawText(ctx, sub.title.toUpperCase(), innerX + 10, cursorY + blockH - 12, {
      size: 6.5,
      bold: true,
      color: sub.accent,
      maxWidth: innerW - 14,
    });

    let itemY = cursorY + blockH - 24;
    for (const item of items) {
      const prefix = sub.italic ? `"${item.trim()}"` : `• ${item.trim()}`;
      for (const line of wrapLines(prefix, SUMMARY_LINE_CHARS)) {
        drawText(ctx, line, innerX + 12, itemY, {
          size: 7.5,
          color: brandNavy,
          maxWidth: innerW - 16,
        });
        itemY -= 9.5;
      }
    }
    cursorY -= 6;
  }

  return y - 8;
}

function drawFooter(ctx: PdfCtx) {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  ctx.page.drawLine({
    start: { x: MARGIN, y: MARGIN + 20 },
    end: { x: PAGE_W - MARGIN, y: MARGIN + 20 },
    thickness: 0.5,
    color: borderSoft,
  });
  drawText(ctx, `Generated ${date}`, MARGIN, MARGIN + 6, { size: 7, color: slateLight });
  drawText(ctx, "UnHired · AI Assessment", PAGE_W / 2 - 48, MARGIN + 6, { size: 7, bold: true, color: brandNavy });
  drawText(ctx, "Confidential Report", PAGE_W - MARGIN - 72, MARGIN + 6, { size: 7, bold: true, color: accent });
}

export async function buildScorecardSharePdfBytes(payload: ScorecardSharePublicPayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: PdfCtx = { page, font, fontBold };

  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: bgGray });

  let y = PAGE_H - MARGIN;
  y = drawHeader(ctx, payload, y);
  y = drawOverviewCards(ctx, payload, y);
  y = drawScoreDistribution(ctx, y);
  y = drawSkillsTable(ctx, payload, y);
  y = drawSummarySection(ctx, doc, payload.scorecard, y);
  drawFooter(ctx);

  return doc.save();
}
