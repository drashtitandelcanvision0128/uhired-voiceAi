import { NextResponse } from "next/server";
import { buildScorecardSharePdfBytes } from "@/lib/scorecard-share-pdf";
import { buildScorecardSharePublicPayload } from "@/lib/scorecard-share-payload";
import { findActiveScorecardShareByRawToken } from "@/lib/scorecard-share-resolve";
import { prisma } from "@/lib/prisma";
import { writePlatformAuditLog } from "@/lib/platform-audit-log";
import { getClientIpFromRequest } from "@/lib/rate-limit";

type Context = {
  params: Promise<{ token: string }>;
};

export async function GET(request: Request, context: Context) {
  const { token } = await context.params;
  const decoded = decodeURIComponent(token);
  const link = await findActiveScorecardShareByRawToken(decoded);
  if (!link) {
    return new NextResponse(null, { status: 404 });
  }

  await writePlatformAuditLog(prisma, {
    level: "INFO",
    category: "SECURITY",
    title: "Scorecard PDF downloaded",
    message: `Public scorecard PDF accessed for session ${link.sessionId}.`,
    actor: getClientIpFromRequest(request),
    metadata: { sessionId: link.sessionId, companyId: link.companyId },
  });

  const payload = buildScorecardSharePublicPayload(link, link.session, { forCompanyReport: true });
  let bytes: Uint8Array;
  try {
    bytes = await buildScorecardSharePdfBytes(payload);
  } catch (err) {
    console.error("scorecard share pdf", err);
    return NextResponse.json({ error: "Unable to generate PDF." }, { status: 500 });
  }
  const body = Buffer.from(bytes);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="candidate-assessment-report.pdf"',
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
