import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureCompanyDecoupled } from "@/lib/decouple-backfill";
import { generateAccessCode } from "@/lib/codes";
import { setCandidateInterviewSessionCookie } from "@/lib/candidate-interview-auth";
import { keySkillsForDb, resolveSessionKeySkills } from "@/lib/session-key-skills";
import { normalizeEmail } from "@/lib/parse-candidate-emails";
import { getInviteAccessState } from "@/lib/requirement-invite-expiry";
import { lookupInterviewByAccessCode } from "@/lib/interview-access-code";
import {
  checkRateLimitAsync,
  getClientIpFromRequest,
  rateLimitResponse,
} from "@/lib/rate-limit";

const schema = z.object({
  accessCode: z.string().trim().min(1),
  candidateName: z.string().trim().min(1),
  email: z.string().trim().email(),
});

export async function POST(request: Request) {
  try {
    const clientIp = getClientIpFromRequest(request);
    const rate = await checkRateLimitAsync("candidate-verify", clientIp, 20, 15 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(rateLimitResponse(rate.retryAfterSec), { status: 429 });
    }

    const body = schema.parse(await request.json());
    const normalizedEmail = normalizeEmail(body.email);
    const accessCode = body.accessCode.trim();

    const { invite, requirement } = await lookupInterviewByAccessCode(accessCode);

    if (!requirement || !invite) {
      return NextResponse.json(
        {
          error:
            "We could not find that interview code. Use the personal link from your interview email — not the apply link.",
        },
        { status: 422 },
      );
    }

    if (invite && normalizeEmail(invite.email) !== normalizedEmail) {
      return NextResponse.json(
        { error: "This interview code is linked to a different email address." },
        { status: 403 },
      );
    }

    await ensureCompanyDecoupled(requirement.companyId);

    // A LIVE session means the interview is already underway. It stays locked to the
    // device that started it (via the signed session cookie) and cannot be reopened from
    // the invite link — this prevents a shared code from being used on another device.
    const liveAttempt = await prisma.interviewSession.findFirst({
      where: {
        sessionType: "COMPANY",
        companyId: requirement.companyId,
        requirementId: requirement.id,
        candidateEmail: normalizedEmail,
        status: "LIVE",
      },
      select: { id: true },
    });
    if (liveAttempt) {
      return NextResponse.json(
        {
          error:
            "This interview is already in progress on another browser/device. Continue from the same browser where you started, or ask the company for a new invite if you lost access.",
        },
        { status: 409 },
      );
    }

    // Re-entry is only allowed into an unstarted (READY) attempt this candidate already created
    // (e.g. they refreshed before starting). A used code cannot start a brand-new attempt.
    const resumableReadyAttempt = invite
      ? await prisma.interviewSession.findFirst({
          where: {
            sessionType: "COMPANY",
            companyId: requirement.companyId,
            requirementId: requirement.id,
            candidateEmail: normalizedEmail,
            status: "READY",
          },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        })
      : null;

    if (invite?.usedAt && !resumableReadyAttempt) {
      return NextResponse.json(
        {
          error: "This interview code has already been used. Please ask the company to send a new invite.",
        },
        { status: 409 },
      );
    }

    if (!resumableReadyAttempt) {
      const access = getInviteAccessState(invite);
      if (!access.allowed) {
        return NextResponse.json(
          { error: access.message },
          { status: access.reason === "expired" ? 410 : 403 },
        );
      }
    }

    const completedAttempt = await prisma.interviewSession.findFirst({
      where: {
        sessionType: "COMPANY",
        companyId: requirement.companyId,
        requirementId: requirement.id,
        candidateEmail: normalizedEmail,
        status: "COMPLETED",
      },
      select: { id: true },
    });
    if (completedAttempt) {
      return NextResponse.json(
        { error: "This candidate email has already completed this interview requirement." },
        { status: 409 },
      );
    }

    const requirementKeySkills = keySkillsForDb(resolveSessionKeySkills(null, requirement));

    const activeAttempt = await prisma.interviewSession.findFirst({
      where: {
        sessionType: "COMPANY",
        companyId: requirement.companyId,
        requirementId: requirement.id,
        candidateEmail: normalizedEmail,
        status: "READY",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, keySkills: true, candidateId: true },
    });
    if (activeAttempt) {
      const candidateName = body.candidateName.trim();
      const sessionUpdate: { candidateName: string; keySkills?: string[] } = { candidateName };
      if (requirementKeySkills && !resolveSessionKeySkills(activeAttempt, null).length) {
        sessionUpdate.keySkills = requirementKeySkills;
      }
      await prisma.interviewSession.update({
        where: { id: activeAttempt.id },
        data: sessionUpdate,
      });
      if (activeAttempt.candidateId) {
        await prisma.candidate.update({
          where: { id: activeAttempt.candidateId },
          data: { name: candidateName },
        });
      } else {
        await prisma.candidate.updateMany({
          where: {
            companyId: requirement.companyId,
            email: normalizedEmail,
            isArchived: false,
          },
          data: { name: candidateName },
        });
      }
      if (invite && !invite.usedAt) {
        await prisma.requirementInvite.updateMany({
          where: { id: invite.id, companyId: requirement.companyId, usedAt: null },
          data: { usedAt: new Date() },
        });
      }
      const response = NextResponse.json({ sessionId: activeAttempt.id });
      try {
        setCandidateInterviewSessionCookie(response, activeAttempt.id, normalizedEmail);
      } catch {
        // Keep candidate flow available even if session cookie secret is not configured.
      }
      return response;
    }

    const existingCandidate = await prisma.candidate.findFirst({
      where: {
        companyId: requirement.companyId,
        email: normalizedEmail,
        isArchived: false,
      },
      select: { id: true },
    });

    let candidateId = existingCandidate?.id ?? null;
    if (candidateId) {
      await prisma.candidate.update({
        where: { id: candidateId },
        data: { name: body.candidateName },
      });
    } else {
      const createdCandidate = await prisma.candidate.create({
        data: {
          companyId: requirement.companyId,
          name: body.candidateName,
          email: normalizedEmail,
        },
        select: { id: true },
      });
      candidateId = createdCandidate.id;
    }

    let createdAttempt: { id: string };
    try {
      createdAttempt = await prisma.$transaction(async (tx) => {
        // Claim invite atomically so concurrent verifies cannot both create sessions.
        if (invite) {
          const claimed = await tx.requirementInvite.updateMany({
            where: { id: invite.id, companyId: requirement.companyId, usedAt: null },
            data: { usedAt: new Date() },
          });
          if (claimed.count === 0) {
            throw new Error("INVITE_ALREADY_USED");
          }
        }

        return tx.interviewSession.create({
          data: {
            accessCode: generateAccessCode("CMP"),
            sessionType: "COMPANY",
            status: "READY",
            isPaid: true,
            companyId: requirement.companyId,
            companyName: null,
            requirementId: requirement.id,
            candidateId,
            candidateName: body.candidateName,
            candidateEmail: normalizedEmail,
            positionTitle: requirement.title ?? requirement.topic,
            domain: requirement.domain,
            topic: requirement.topic,
            durationMin: requirement.durationMin,
            jobDescription: requirement.jobDescription,
            keySkills: requirementKeySkills,
            maxOptionalQuestions: requirement.maxOptionalQuestions,
            questions: {
              create: requirement.questions.map((q, index) => ({
                prompt: q.prompt,
                expectedAnswer: q.expectedAnswer,
                gradingRubric: q.gradingRubric,
                difficulty: q.difficulty ?? "medium",
                orderIndex: index,
                isMandatory: q.isMandatory,
              })),
            },
          },
          select: { id: true },
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "INVITE_ALREADY_USED") {
        return NextResponse.json(
          {
            error: "This interview code has already been used. Please ask the company to send a new invite.",
          },
          { status: 409 },
        );
      }
      throw error;
    }

    const response = NextResponse.json({ sessionId: createdAttempt.id });
    try {
      setCandidateInterviewSessionCookie(response, createdAttempt.id, normalizedEmail);
    } catch {
      // Keep candidate flow available even if session cookie secret is not configured.
    }

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    console.error("[candidate/verify POST]", error);
    return NextResponse.json({ error: "Unable to verify interview code." }, { status: 500 });
  }
}
