import { NextResponse } from "next/server";
import { processEmailOutbox } from "@/lib/email-outbox";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET?.trim() || "";
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server." },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization")?.trim() ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const headerSecret = request.headers.get("x-cron-secret")?.trim() ?? "";
  const provided = bearer || headerSecret;
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await processEmailOutbox(prisma, { limit: 50 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/email-outbox]", error);
    return NextResponse.json({ error: "Unable to process email outbox." }, { status: 500 });
  }
}
