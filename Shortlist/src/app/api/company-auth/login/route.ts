import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { companyAdminLoginSchema, setCompanyAdminSessionCookie } from "@/lib/company-admin-auth";
import {
  ensureCompanyAdminMember,
  findActiveMemberByEmail,
  touchMemberLogin,
} from "@/lib/company-members";
import {
  hashCompanyPasscode,
  needsPasscodeRehash,
  verifyCompanyPasscode,
} from "@/lib/company-passcode";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = companyAdminLoginSchema.parse(await request.json());
    const authError = NextResponse.json({ error: "Invalid company credentials." }, { status: 401 });

    const companyEmail = body.companyEmail.toLowerCase();

    const member = await findActiveMemberByEmail(companyEmail);
    if (member) {
      if (!verifyCompanyPasscode(body.passcode, member.company.adminPasscode)) {
        return authError;
      }
      if (needsPasscodeRehash(member.company.adminPasscode)) {
        await prisma.company.update({
          where: { id: member.company.id },
          data: { adminPasscode: hashCompanyPasscode(body.passcode) },
        });
      }
      await touchMemberLogin(member.id);
      const response = NextResponse.json({ ok: true, role: member.role });
      try {
        await setCompanyAdminSessionCookie(response, {
          companyId: member.company.id,
          companyName: member.company.name,
          memberId: member.id,
          memberEmail: member.email,
          role: member.role,
        });
      } catch {
        return NextResponse.json(
          {
            error:
              "Server is not configured for company sessions (set COMPANY_SESSION_SECRET or ADMIN_PORTAL_KEY).",
          },
          { status: 500 },
        );
      }
      return response;
    }

    const company = await prisma.company.findFirst({
      where: {
        adminEmail: companyEmail,
        isActive: true,
      },
    });

    if (!company) {
      return authError;
    }
    if (!verifyCompanyPasscode(body.passcode, company.adminPasscode)) {
      return authError;
    }

    if (needsPasscodeRehash(company.adminPasscode)) {
      await prisma.company.update({
        where: { id: company.id },
        data: { adminPasscode: hashCompanyPasscode(body.passcode) },
      });
    }

    const adminMember = await ensureCompanyAdminMember(company.id, company.adminEmail);
    await touchMemberLogin(adminMember.id);

    const response = NextResponse.json({ ok: true, role: adminMember.role });
    try {
      await setCompanyAdminSessionCookie(response, {
        companyId: company.id,
        companyName: company.name,
        memberId: adminMember.id,
        memberEmail: adminMember.email,
        role: adminMember.role,
      });
    } catch {
      return NextResponse.json(
        {
          error:
            "Server is not configured for company sessions (set COMPANY_SESSION_SECRET or ADMIN_PORTAL_KEY).",
        },
        { status: 500 },
      );
    }
    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    console.error("[company-auth/login]", error);
    return NextResponse.json({ error: "Unable to login." }, { status: 500 });
  }
}
