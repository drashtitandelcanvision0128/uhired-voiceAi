import { NextResponse } from "next/server";
import {
  getCookieValueFromHeader,
  getMasterSessionExpiry,
  MASTER_SESSION_COOKIE,
  verifyMasterSessionToken,
} from "@/lib/master-auth";

export async function GET(request: Request) {
  const token = getCookieValueFromHeader(request.headers.get("cookie"), MASTER_SESSION_COOKIE);
  const authenticated = verifyMasterSessionToken(token);
  const expiresAt = getMasterSessionExpiry(token);

  return NextResponse.json({
    authenticated,
    expiresAt: expiresAt?.toISOString() ?? null,
    expiresInSec:
      expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)) : 0,
  });
}
