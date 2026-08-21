import { NextResponse } from "next/server";
import { abandonStuckLiveSessions } from "@/lib/master-stuck-sessions";
import { processEmailOutbox } from "@/lib/email-outbox";
import { runDataRetentionCleanup } from "@/lib/data-retention";
import { prisma } from "@/lib/prisma";
import { writePlatformAuditLog } from "@/lib/platform-audit-log";

function authorizeCron(request: Request) {
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
  return null;
}

async function reconcileOrphanPayments() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const orphans = await prisma.practicePayment.findMany({
    where: {
      status: "VERIFIED",
      sessionId: null,
      createdAt: { lt: cutoff },
    },
    select: { id: true, orderId: true, candidateEmail: true },
    take: 50,
  });
  if (orphans.length === 0) {
    return { orphanCount: 0 };
  }
  await writePlatformAuditLog(prisma, {
    level: "WARNING",
    category: "PAYMENT",
    title: "Verified payments without sessions",
    message: `${orphans.length} VERIFIED practice payment(s) older than 24h still have no session — check Razorpay reconcile.`,
    metadata: {
      orphanCount: String(orphans.length),
      orderIds: orphans.map((p) => p.orderId).slice(0, 20).join(","),
    },
  });
  return { orphanCount: orphans.length };
}

/**
 * Combined maintenance job for Coolify / external cron (every 15–30 min):
 * - abandon stuck LIVE sessions
 * - process email outbox retries
 * - data retention cleanup (videos/transcripts)
 * - flag orphan verified payments
 */
export async function POST(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  try {
    const [abandon, outbox, retention, payments] = await Promise.all([
      abandonStuckLiveSessions(prisma, { limit: 100, actor: "cron-maintenance" }),
      processEmailOutbox(prisma, { limit: 25 }),
      runDataRetentionCleanup(prisma),
      reconcileOrphanPayments(),
    ]);

    return NextResponse.json({
      ok: true,
      abandon,
      outbox,
      retention,
      payments,
    });
  } catch (error) {
    console.error("[cron/maintenance]", error);
    return NextResponse.json({ error: "Maintenance job failed." }, { status: 500 });
  }
}
