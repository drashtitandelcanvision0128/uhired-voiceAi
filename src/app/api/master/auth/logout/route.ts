import { NextResponse } from "next/server";
import { clearMasterSessionCookie } from "@/lib/master-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearMasterSessionCookie(response);
  return response;
}
