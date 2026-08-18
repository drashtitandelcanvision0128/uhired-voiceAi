import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCompanyPermission } from "@/lib/company-admin-api";
import { normalizeEmail, isValidEmail } from "@/lib/parse-candidate-emails";
import { createScheduledInviteExpiresAt } from "@/lib/requirement-invite-expiry";
import { getEmailLinkBaseUrl } from "@/lib/public-app-url";
import { sendInterviewInviteEmail, isEmailConfigured } from "@/lib/email";

const schema = z.object({
  requirementId: z.string().trim().min(1),
  email: z.string().trim().email(),
  scheduledAt: z.string().trim().min(1),
});

function companyDisplayName(company: {
  name: string;
  brandDisplayName: string | null;
} | null) {
  return company?.brandDisplayName?.trim() || company?.name || "Company";
}

function serializeInvite(invite: {
  id: string;
  email: string;
  candidateName: string | null;
  source: string;
  accessCode: string;
  scheduledAt: Date | null;
  emailSentAt: Date | null;
  usedAt: Date | null;
  expiresAt: Date;
}) {
  return {
    id: invite.id,
    email: invite.email,
    candidateName: invite.candidateName,
    source: invite.source,
    accessCode: invite.accessCode,
    scheduledAt: invite.scheduledAt?.toISOString() ?? null,
    emailSentAt: invite.emailSentAt?.toISOString() ?? null,
    usedAt: invite.usedAt?.toISOString() ?? null,
    expiresAt: invite.expiresAt.toISOString(),
  };
}

export async function POST(request: Request) {
  const authOrResponse = await requireCompanyPermission(request, "invite:send");
  if (authOrResponse instanceof NextResponse) return authOrResponse;
  const authCompany = authOrResponse;

  try {
    const body = schema.parse(await request.json());
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const scheduledAt = new Date(body.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: "Choose a valid interview date and time." }, { status: 400 });
    }
    if (scheduledAt.getTime() < Date.now() - 5 * 60 * 1000) {
      return NextResponse.json({ error: "Interview time must be in the future." }, { status: 400 });
    }
    if (scheduledAt.getTime() > Date.now() + 180 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: "Interview time is too far in the future." }, { status: 400 });
    }

    const requirement = await prisma.requirement.findFirst({
      where: {
        id: body.requirementId,
        companyId: authCompany.companyId,
        isArchived: false,
      },
      select: {
        id: true,
        title: true,
        domain: true,
        durationMin: true,
        company: { select: { name: true, brandDisplayName: true } },
      },
    });
    if (!requirement) {
      return NextResponse.json({ error: "Opening not found." }, { status: 404 });
    }

    const invite = await prisma.requirementInvite.findUnique({
      where: {
        requirementId_email: {
          requirementId: requirement.id,
          email,
        },
      },
    });
    if (!invite || invite.companyId !== authCompany.companyId) {
      return NextResponse.json({ error: "This candidate has not applied for this opening yet." }, { status: 404 });
    }
    if (invite.usedAt) {
      return NextResponse.json({ error: "This candidate has already used their interview link." }, { status: 409 });
    }

    const expiresAt = createScheduledInviteExpiresAt(scheduledAt, requirement.durationMin);
    const appBaseUrl = getEmailLinkBaseUrl(request);
    const interviewUrl = `${appBaseUrl}/candidate?code=${encodeURIComponent(invite.accessCode)}`;
    const roleTitle = requirement.title?.trim() || requirement.domain;
    const companyName = companyDisplayName(requirement.company);
    let emailed = false;
    let emailError: string | null = null;

    if (isEmailConfigured()) {
      try {
        const sendResult = await sendInterviewInviteEmail({
          to: email,
          companyName,
          roleTitle,
          accessCode: invite.accessCode,
          interviewUrl,
          expiresAt,
          scheduledAt,
          candidateName: invite.candidateName ?? undefined,
        });
        const capturedOnly =
          sendResult.provider === "smtp" && sendResult.smtpDeliveryMode === "capture";
        emailed = !capturedOnly;
        if (capturedOnly) {
          emailError = "Email is in capture mode, so the schedule was saved but not delivered.";
        }
      } catch (error) {
        emailError = error instanceof Error ? error.message : "Unable to send the interview email.";
      }
    } else {
      emailError = "Email is not configured. Schedule was saved; send the link manually.";
    }

    const updated = await prisma.requirementInvite.update({
      where: { id: invite.id },
      data: {
        scheduledAt,
        expiresAt,
        emailSentAt: emailed ? new Date() : invite.emailSentAt,
      },
    });

    return NextResponse.json({
      ok: true,
      emailed,
      interviewUrl,
      emailError,
      invite: serializeInvite(updated),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    console.error("[schedule-invite POST]", error);
    return NextResponse.json({ error: "Unable to schedule this interview." }, { status: 500 });
  }
}
