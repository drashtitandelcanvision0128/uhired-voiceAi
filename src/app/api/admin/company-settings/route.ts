import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getCompanyAdminSessionFromCookieHeader,
  setCompanyAdminSessionCookie,
} from "@/lib/company-admin-auth";
import { requireCompanyPermission } from "@/lib/company-admin-api";
import { hashCompanyPasscode } from "@/lib/company-passcode";
import { buildCompanyInterviewerProfile } from "@/lib/interviewer-profile";
import { roleLabel } from "@/lib/company-rbac";
import { withCompanyTenantScope } from "@/lib/prisma-tenant-scope";
import { normalizeBrandPrimaryColor } from "@/lib/company-branding";
import { isInterviewLanguageCode } from "@/lib/interview-languages";

const patchSchema = z.object({
  interviewerName: z.string().trim().max(80).optional(),
  interviewerVoiceGender: z.enum(["MALE", "FEMALE"]).optional(),
  companyName: z.string().trim().min(2).max(120).optional(),
  newPasscode: z.string().trim().min(4).max(64).optional(),
  brandDisplayName: z.string().trim().max(120).optional(),
  brandPrimaryColor: z.string().trim().max(32).optional(),
  brandLogoUrl: z.string().trim().max(500).optional(),
  interviewLanguage: z.string().trim().optional(),
  atsWebhookUrl: z.string().trim().max(500).optional(),
  atsWebhookSecret: z.string().trim().max(128).optional(),
});

export async function GET(request: Request) {
  const auth = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const company = await withCompanyTenantScope(auth.companyId, async (tx) => {
    return tx.company.findUnique({
      where: { id: auth.companyId },
      select: {
        id: true,
        name: true,
        domain: true,
        adminEmail: true,
        interviewerName: true,
        interviewerVoiceGender: true,
        brandDisplayName: true,
        brandPrimaryColor: true,
        brandLogoUrl: true,
        interviewLanguage: true,
        atsWebhookUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const profile = buildCompanyInterviewerProfile({
    interviewerName: company.interviewerName,
    interviewerVoiceGender: company.interviewerVoiceGender,
    companyName: company.name,
  });

  return NextResponse.json({
    companyId: company.id,
    companyName: company.name,
    companyDomain: company.domain,
    adminEmail: company.adminEmail,
    memberEmail: auth.memberEmail,
    memberRole: auth.role,
    memberRoleLabel: roleLabel(auth.role),
    interviewerName: company.interviewerName ?? "",
    interviewerVoiceGender: company.interviewerVoiceGender,
    interviewerDisplayName: profile.displayName,
    voice: profile.voice,
    brandDisplayName: company.brandDisplayName ?? "",
    brandPrimaryColor: company.brandPrimaryColor ?? "",
    brandLogoUrl: company.brandLogoUrl ?? "",
    interviewLanguage: company.interviewLanguage ?? "en",
    atsWebhookUrl: company.atsWebhookUrl ?? "",
    atsWebhookConfigured: Boolean(company.atsWebhookUrl),
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  });
}

export async function PATCH(request: Request) {
  const authOrResponse = await requireCompanyPermission(request, "settings:write");
  if (authOrResponse instanceof NextResponse) return authOrResponse;
  const auth = authOrResponse;

  try {
    const body = patchSchema.parse(await request.json());

    const existing = await prisma.company.findUnique({
      where: { id: auth.companyId },
      select: {
        id: true,
        name: true,
        adminPasscode: true,
        interviewerName: true,
        interviewerVoiceGender: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    // Password changes do not require current password.

    if (body.companyName && body.companyName !== existing.name) {
      const clash = await prisma.company.findFirst({
        where: { name: body.companyName, NOT: { id: existing.id } },
        select: { id: true },
      });
      if (clash) {
        return NextResponse.json({ error: "That company name is already taken." }, { status: 409 });
      }
    }

    const company = await prisma.company.update({
      where: { id: auth.companyId },
      data: {
        ...(body.interviewerName !== undefined
          ? { interviewerName: body.interviewerName || null }
          : {}),
        ...(body.interviewerVoiceGender !== undefined
          ? { interviewerVoiceGender: body.interviewerVoiceGender }
          : {}),
        ...(body.companyName !== undefined ? { name: body.companyName } : {}),
        ...(body.newPasscode !== undefined
          ? { adminPasscode: hashCompanyPasscode(body.newPasscode) }
          : {}),
        ...(body.brandDisplayName !== undefined
          ? { brandDisplayName: body.brandDisplayName || null }
          : {}),
        ...(body.brandPrimaryColor !== undefined
          ? { brandPrimaryColor: normalizeBrandPrimaryColor(body.brandPrimaryColor) }
          : {}),
        ...(body.brandLogoUrl !== undefined
          ? { brandLogoUrl: body.brandLogoUrl.trim() || null }
          : {}),
        ...(body.interviewLanguage !== undefined &&
        isInterviewLanguageCode(body.interviewLanguage)
          ? { interviewLanguage: body.interviewLanguage }
          : {}),
        ...(body.atsWebhookUrl !== undefined
          ? { atsWebhookUrl: body.atsWebhookUrl.trim() || null }
          : {}),
        ...(body.atsWebhookSecret !== undefined && body.atsWebhookSecret.trim()
          ? { atsWebhookSecret: body.atsWebhookSecret.trim() }
          : {}),
      },
      select: {
        id: true,
        name: true,
        domain: true,
        adminEmail: true,
        interviewerName: true,
        interviewerVoiceGender: true,
        brandDisplayName: true,
        brandPrimaryColor: true,
        brandLogoUrl: true,
        interviewLanguage: true,
        atsWebhookUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const profile = buildCompanyInterviewerProfile({
      interviewerName: company.interviewerName,
      interviewerVoiceGender: company.interviewerVoiceGender,
      companyName: company.name,
    });

    const response = NextResponse.json({
      ok: true,
      companyName: company.name,
      companyDomain: company.domain,
      adminEmail: company.adminEmail,
      interviewerName: company.interviewerName ?? "",
      interviewerVoiceGender: company.interviewerVoiceGender,
      interviewerDisplayName: profile.displayName,
      voice: profile.voice,
      passwordUpdated: body.newPasscode !== undefined,
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString(),
    });

    if (body.companyName && body.companyName !== existing.name) {
      await setCompanyAdminSessionCookie(response, {
        companyId: company.id,
        companyName: company.name,
        memberId: auth.memberId,
        memberEmail: auth.memberEmail,
        role: auth.role,
      });
    }

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to save settings." }, { status: 500 });
  }
}
