import { NextResponse } from "next/server";
import { lookupInterviewByAccessCode } from "@/lib/interview-access-code";
import { getInviteAccessState } from "@/lib/requirement-invite-expiry";
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

  if (!requirement || !invite) {
    return NextResponse.json({
      valid: false,
      error:
        "We could not find that interview code. Use the personal link from your interview email — not the apply link.",
    });
  }

  const company = await prisma.company.findUnique({
    where: { id: requirement.companyId },
    select: { name: true, brandDisplayName: true, brandPrimaryColor: true, brandLogoUrl: true },
  });

  const roleTitle = requirement.title?.trim() || requirement.domain;
  const access = getInviteAccessState(invite);
  const expired = !access.allowed && access.reason === "expired";
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
    valid: access.allowed,
    expired,
    companyName,
    brandColor: company?.brandPrimaryColor ?? null,
    logoUrl: company?.brandLogoUrl ?? null,
    roleTitle,
    durationMin: requirement.durationMin,
    scheduledAt: invite.scheduledAt?.toISOString() ?? null,
    opensAt: !access.allowed && access.opensAt ? access.opensAt.toISOString() : null,
    expiresAt: invite.expiresAt?.toISOString() ?? null,
    emailHint: invite.email ? maskEmail(invite.email) : null,
    interviewLanguage: requirement.interviewLanguage ?? null,
    error: access.allowed ? null : access.message,
  });
}
