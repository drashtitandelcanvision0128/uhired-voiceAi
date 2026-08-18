import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateUniqueCandidateInviteCode } from "@/lib/candidate-invite-code";
import { normalizeEmail, isValidEmail } from "@/lib/parse-candidate-emails";
import { createShareApplyHoldExpiresAt } from "@/lib/requirement-invite-expiry";
import { checkRateLimitAsync, getClientIpFromRequest, rateLimitResponse } from "@/lib/rate-limit";

type Context = {
  params: Promise<{ code: string }>;
};

const applySchema = z.object({
  candidateName: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
});

function companyDisplayName(company: {
  name: string;
  brandDisplayName: string | null;
} | null) {
  return company?.brandDisplayName?.trim() || company?.name || "Company";
}

async function findOpenRequirement(code: string) {
  const accessCode = code.trim();
  if (!accessCode) return null;
  return prisma.requirement.findFirst({
    where: {
      accessCode: { equals: accessCode, mode: "insensitive" },
      isArchived: false,
    },
    select: {
      id: true,
      companyId: true,
      title: true,
      domain: true,
      topic: true,
      durationMin: true,
      jobDescription: true,
      company: {
        select: {
          name: true,
          brandDisplayName: true,
          brandPrimaryColor: true,
          brandLogoUrl: true,
        },
      },
    },
  });
}

export async function GET(_request: Request, context: Context) {
  const { code } = await context.params;
  const requirement = await findOpenRequirement(code);
  if (!requirement) {
    return NextResponse.json({ valid: false, error: "This apply link is invalid or no longer active." }, { status: 404 });
  }

  const roleTitle = requirement.title?.trim() || requirement.domain;
  const jd = requirement.jobDescription?.trim() ?? "";

  return NextResponse.json({
    valid: true,
    companyName: companyDisplayName(requirement.company),
    brandColor: requirement.company.brandPrimaryColor,
    logoUrl: requirement.company.brandLogoUrl,
    roleTitle,
    durationMin: requirement.durationMin,
    jobDescription: jd.length > 600 ? `${jd.slice(0, 600).trim()}…` : jd || null,
  });
}

export async function POST(request: Request, context: Context) {
  const ip = getClientIpFromRequest(request);
  const ipLimit = await checkRateLimitAsync("apply-link-ip", ip, 8, 15 * 60 * 1000);
  if (!ipLimit.allowed) {
    return NextResponse.json(rateLimitResponse(ipLimit.retryAfterSec), { status: 429 });
  }

  const { code } = await context.params;
  const requirement = await findOpenRequirement(code);
  if (!requirement) {
    return NextResponse.json({ error: "This apply link is invalid or no longer active." }, { status: 404 });
  }

  try {
    const body = applySchema.parse(await request.json());
    const email = normalizeEmail(body.email);
    const candidateName = body.candidateName.trim();
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const emailLimit = await checkRateLimitAsync("apply-link-email", `${requirement.id}:${email}`, 3, 60 * 60 * 1000);
    if (!emailLimit.allowed) {
      return NextResponse.json(rateLimitResponse(emailLimit.retryAfterSec), { status: 429 });
    }

    const completed = await prisma.interviewSession.findFirst({
      where: {
        sessionType: "COMPANY",
        companyId: requirement.companyId,
        requirementId: requirement.id,
        candidateEmail: email,
        status: "COMPLETED",
      },
      select: { id: true },
    });
    if (completed) {
      return NextResponse.json(
        { error: "This email has already completed an interview for this opening." },
        { status: 409 },
      );
    }

    const companyName = companyDisplayName(requirement.company);
    const inviteExpiresAt = createShareApplyHoldExpiresAt();
    const existingInvite = await prisma.requirementInvite.findUnique({
      where: {
        requirementId_email: {
          requirementId: requirement.id,
          email,
        },
      },
      select: { id: true, accessCode: true, usedAt: true, scheduledAt: true },
    });

    if (existingInvite && !existingInvite.usedAt) {
      await prisma.requirementInvite.update({
        where: { id: existingInvite.id },
        data: {
          candidateName,
          source: "share",
          ...(existingInvite.scheduledAt ? {} : { expiresAt: inviteExpiresAt }),
        },
      });
    } else if (existingInvite?.usedAt) {
      const accessCode = await generateUniqueCandidateInviteCode(companyName);
      await prisma.requirementInvite.update({
        where: { id: existingInvite.id },
        data: {
          accessCode,
          candidateName,
          source: "share",
          scheduledAt: null,
          expiresAt: inviteExpiresAt,
          usedAt: null,
          emailSentAt: null,
        },
      });
    } else {
      const accessCode = await generateUniqueCandidateInviteCode(companyName);
      await prisma.requirementInvite.create({
        data: {
          requirementId: requirement.id,
          companyId: requirement.companyId,
          email,
          candidateName,
          source: "share",
          accessCode,
          expiresAt: inviteExpiresAt,
        },
      });
    }

    const existingCandidate = await prisma.candidate.findFirst({
      where: { companyId: requirement.companyId, email, isArchived: false },
      select: { id: true },
    });
    if (existingCandidate) {
      await prisma.candidate.update({
        where: { id: existingCandidate.id },
        data: { name: candidateName },
      });
    } else {
      await prisma.candidate.create({
        data: {
          companyId: requirement.companyId,
          name: candidateName,
          email,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      status: existingInvite?.scheduledAt && !existingInvite.usedAt ? "scheduled" : "applied",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Enter your name and email." }, { status: 400 });
    }
    console.error("[apply POST]", error);
    return NextResponse.json({ error: "Unable to submit your application. Try again." }, { status: 500 });
  }
}
