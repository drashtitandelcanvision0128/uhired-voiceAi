import { NextResponse } from "next/server";
import { lookupInterviewByAccessCode } from "@/lib/interview-access-code";
import { isInviteExpired } from "@/lib/requirement-invite-expiry";
import { prisma } from "@/lib/prisma";

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return null;
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`;
}

function companyDisplayName(company: {
  name: string;
  brandDisplayName: string | null;
} | null) {
  return company?.brandDisplayName?.trim() || company?.name || null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim() ?? "";

  if (!code) {
    return NextResponse.json({ valid: false, error: "Interview code is required." }, { status: 400 });
  }

  const { invite, requirement } = await lookupInterviewByAccessCode(code);

  if (!requirement) {
    return NextResponse.json({
      valid: false,
      error: "We could not find that interview code.",
    });
  }

  const company = await prisma.company.findUnique({
    where: { id: requirement.companyId },
    select: { name: true, brandDisplayName: true, brandPrimaryColor: true, brandLogoUrl: true },
  });

  const roleTitle = requirement.title?.trim() || requirement.domain;
  const expired = invite ? isInviteExpired(invite.expiresAt) : false;
  const companyName = companyDisplayName(company);

  if (invite?.usedAt) {
    const completed = await prisma.interviewSession.findFirst({
      where: {
        requirementId: requirement.id,
        candidateEmail: invite.email,
        status: "COMPLETED",
      },
      select: { id: true },
    });
    if (completed) {
      return NextResponse.json({
        valid: false,
        error: "This interview has already been completed.",
        companyName,
        roleTitle,
      });
    }
  }

  return NextResponse.json({
    valid: !expired,
    expired,
    companyName,
    brandColor: company?.brandPrimaryColor ?? null,
    logoUrl: company?.brandLogoUrl ?? null,
    roleTitle,
    durationMin: requirement.durationMin,
    expiresAt: invite?.expiresAt?.toISOString() ?? null,
    emailHint: invite?.email ? maskEmail(invite.email) : null,
    interviewLanguage: requirement.interviewLanguage ?? null,
    error: expired ? "This interview invite has expired. Ask the company to send a new invite." : null,
  });
}
