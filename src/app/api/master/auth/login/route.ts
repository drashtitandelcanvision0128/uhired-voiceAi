import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertMasterAdminKey,
  masterAdminLoginSchema,
  setMasterSessionCookie,
} from "@/lib/master-auth";
import { verifyMasterAdminLogin } from "@/lib/master-admin-account";
import { recordMasterLoginEvent } from "@/lib/master-login-audit";
import {
  getClientIpFromRequest,
  getMasterLoginRateLimitMessage,
  isMasterLoginRateLimited,
} from "@/lib/master-login-rate-limit";
import { prisma } from "@/lib/prisma";

const legacyBodySchema = z.object({
  masterKey: z.string().trim().min(1),
  trustDevice: z.boolean().optional(),
});

function getUserAgent(request: Request) {
  const value = request.headers.get("user-agent");
  return value ? value.slice(0, 500) : null;
}

export async function POST(request: Request) {
  const clientIp = getClientIpFromRequest(request);
  const userAgent = getUserAgent(request);

  if (isMasterLoginRateLimited(clientIp)) {
    return NextResponse.json({ error: getMasterLoginRateLimitMessage() }, { status: 429 });
  }

  try {
    const rawBody = await request.json();
    let trustDevice = false;
    let loginEmail = process.env.MASTER_ADMIN_EMAIL?.trim().toLowerCase() ?? "master@uhired.com";
    let loginOk = false;

    if ("masterKey" in rawBody && rawBody.masterKey) {
      const body = legacyBodySchema.parse(rawBody);
      trustDevice = body.trustDevice ?? false;
      const keyCheck = assertMasterAdminKey(body.masterKey);
      if (!keyCheck.ok) {
        await recordMasterLoginEvent(prisma, {
          email: loginEmail,
          success: false,
          clientIp,
          userAgent,
          trustDevice,
        });
        return NextResponse.json({ error: keyCheck.error }, { status: 401 });
      }
      loginOk = true;
    } else {
      const body = masterAdminLoginSchema.parse(rawBody);
      trustDevice = body.trustDevice ?? false;
      loginEmail = body.adminEmail.trim().toLowerCase();
      const credentialCheck = await verifyMasterAdminLogin(prisma, body.adminEmail, body.passcode);
      if (!credentialCheck.ok) {
        await recordMasterLoginEvent(prisma, {
          email: loginEmail,
          success: false,
          clientIp,
          userAgent,
          trustDevice,
        });
        return NextResponse.json({ error: credentialCheck.error }, { status: 401 });
      }
      loginOk = true;
    }

    if (!loginOk) {
      return NextResponse.json({ error: "Unable to login." }, { status: 401 });
    }

    await recordMasterLoginEvent(prisma, {
      email: loginEmail,
      success: true,
      clientIp,
      userAgent,
      trustDevice,
    });

    const response = NextResponse.json({
      ok: true,
      trustDevice,
      sessionTtlSec: trustDevice ? 60 * 60 * 24 * 30 : 60 * 45,
    });
    setMasterSessionCookie(response, { trustDevice, email: loginEmail });
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to login." }, { status: 500 });
  }
}
