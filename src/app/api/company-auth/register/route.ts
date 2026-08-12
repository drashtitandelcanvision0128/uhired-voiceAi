import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import {
  companyRegisterSchema,
  normalizeCompanyDomain,
  setCompanyAdminSessionCookie,
} from "@/lib/company-admin-auth";
import { ensureCompanyAdminMember } from "@/lib/company-members";
import { hashCompanyPasscode } from "@/lib/company-passcode";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = companyRegisterSchema.parse(await request.json());

    if (body.honeypot?.trim()) {
      return NextResponse.json({ ok: true });
    }

    const companyName = body.companyName.trim();
    const domain = normalizeCompanyDomain(body.companyDomain);
    const adminEmail = body.companyEmail.trim().toLowerCase();

    const existingByName = await prisma.company.findUnique({
      where: { name: companyName },
      select: { id: true },
    });
    if (existingByName) {
      return NextResponse.json(
        { error: "A company with this name is already registered." },
        { status: 409 },
      );
    }

    const existingByDomain = await prisma.company.findFirst({
      where: { domain },
      select: { id: true },
    });
    if (existingByDomain) {
      return NextResponse.json(
        { error: "A company with this domain is already registered." },
        { status: 409 },
      );
    }

    const company = await prisma.company.create({
      data: {
        name: companyName,
        domain,
        adminEmail,
        adminPasscode: hashCompanyPasscode(body.passcode),
        isActive: true,
      },
    });

    const adminMember = await ensureCompanyAdminMember(company.id, adminEmail);

    const response = NextResponse.json({ ok: true, companyId: company.id });
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
            "Company created but server is not configured for sessions (set COMPANY_SESSION_SECRET or ADMIN_PORTAL_KEY).",
        },
        { status: 500 },
      );
    }
    return response;
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "A company with these details is already registered." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Unable to register company." }, { status: 500 });
  }
}
