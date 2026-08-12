import { NextResponse } from "next/server";
import { getCompanyAdminSessionFromCookieHeader } from "@/lib/company-admin-auth";

export async function GET(request: Request) {
  const session = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    companyId: session.companyId,
    companyName: session.companyName,
  });
}
