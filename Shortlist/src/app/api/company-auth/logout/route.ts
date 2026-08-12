import { NextResponse } from "next/server";
import { clearCompanyAdminSessionCookie } from "@/lib/company-admin-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearCompanyAdminSessionCookie(response);
  return response;
}
