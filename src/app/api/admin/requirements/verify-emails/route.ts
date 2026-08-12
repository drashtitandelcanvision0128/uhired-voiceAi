import { NextResponse } from "next/server";
import { z } from "zod";
import { getCompanyAdminSessionFromCookieHeader } from "@/lib/company-admin-auth";
import { dedupeEmails } from "@/lib/parse-candidate-emails";
import { verifyCandidateEmails } from "@/lib/email-verification.server";

const schema = z.object({
  emails: z.array(z.string().trim().min(1)).min(1).max(50),
});

export async function POST(request: Request) {
  const authCompany = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!authCompany) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = schema.parse(await request.json());
    const emails = dedupeEmails(body.emails);
    const results = await verifyCandidateEmails(emails);
    const validCount = results.filter((row) => row.valid).length;
    const invalidCount = results.length - validCount;

    return NextResponse.json({
      results,
      validCount,
      invalidCount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to verify emails." }, { status: 500 });
  }
}
