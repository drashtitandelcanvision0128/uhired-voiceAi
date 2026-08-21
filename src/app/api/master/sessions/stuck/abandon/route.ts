import { NextResponse } from "next/server";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { abandonStuckLiveSessions } from "@/lib/master-stuck-sessions";
import { prisma } from "@/lib/prisma";

/** Master-triggered reclaim of stuck LIVE sessions (marks them FAILED). */
export async function POST(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await abandonStuckLiveSessions(prisma, {
      limit: 100,
      actor: "master-admin",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: "Unable to abandon stuck LIVE sessions." }, { status: 500 });
  }
}
