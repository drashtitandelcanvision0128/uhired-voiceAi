import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureCompanyDecoupled } from "@/lib/decouple-backfill";
import { keySkillsForDb } from "@/lib/session-key-skills";
import { getCompanyAdminSessionFromCookieHeader } from "@/lib/company-admin-auth";
import { requireCompanyPermission } from "@/lib/company-admin-api";
import { questionInputSchema } from "@/lib/interview-questions";
import { fillMissingIdealAnswersOnInputs } from "@/lib/generate-ideal-answers";
import {
  resolveMandatoryQuestionsForRequirement,
} from "@/lib/resolve-requirement-questions";
import { computeMandatoryQuestionCount } from "@/lib/interview-duration";
import {
  buildNestedRequirementQuestionCreate,
  resolveMandatoryOptionalQuestions,
} from "@/lib/requirement-question-payload";
import { generateUniqueCandidateInviteCode } from "@/lib/candidate-invite-code";
import { dedupeEmails, validateEmailBatch } from "@/lib/parse-candidate-emails";
import { sendInterviewInviteEmail, isEmailConfigured, getEmailSendDelayMs, sleep } from "@/lib/email";
import { enqueueInterviewInviteEmail } from "@/lib/email-outbox";
import { writePlatformAuditLog } from "@/lib/platform-audit-log";
import { createInviteExpiresAt } from "@/lib/requirement-invite-expiry";
import { isInterviewLanguageCode } from "@/lib/interview-languages";
import { getEmailLinkBaseUrl, getPublicAppBaseUrl } from "@/lib/public-app-url";
import { verifyCandidateEmails } from "@/lib/email-verification.server";
import {
  CAPTURE_SMTP_DEV_NOTE,
  CAPTURE_SMTP_PRODUCTION_ERROR,
  getSmtpDeliveryMode,
  resolveEmailProvider,
} from "@/lib/smtp-delivery-mode";
import {
  buildInviteDeliverySummary,
  classifySmtpError,
  isSmtpAuthError,
  SPAM_FOLDER_NOTE,
  SES_SANDBOX_NOTE,
  SES_IAM_NOTE,
  SMTP_AUTH_NOTE,
  type InviteDeliveryRow,
} from "@/lib/invite-delivery";

/** Batch invites can take ~1.5s per email (Mailtrap rate limit). */
export const maxDuration = 120;

const requirementSchema = z.object({
  requirementId: z.string().trim().optional(),
  positionTitle: z.string().trim().optional(),
  domain: z.string().trim().optional(),
  topic: z.string().trim().optional(),
  durationMin: z.coerce.number().min(5).max(120),
  jobDescription: z.string().trim().optional(),
  keySkills: z.array(z.string()).optional(),
  questions: z.array(z.string()).max(5).optional(),
  optionalQuestions: z.array(z.string()).optional(),
  mandatoryIdealAnswers: z.string().optional(),
  optionalIdealAnswers: z.string().optional(),
  mandatoryQuestions: z.array(questionInputSchema).max(5).optional(),
  optionalQuestionsStructured: z.array(questionInputSchema).optional(),
  maxOptionalQuestions: z.coerce.number().int().min(0).max(20).optional(),
  interviewLanguage: z.string().trim().optional(),
});

const schema = z.object({
  source: z.enum(["manual", "excel"]),
  emails: z.array(z.string().trim().min(1)).min(1),
  requirement: requirementSchema,
});

function parseStringArray(value: Prisma.JsonValue | string[] | undefined): string[] {
  if (!value) return [];
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (trimmed) result.push(trimmed);
    }
  }
  return result;
}

export async function POST(request: Request) {
  try {
    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          error:
            "Email is not configured. Add SMTP settings or AWS SES credentials (EMAIL_PROVIDER=ses) to your environment.",
        },
        { status: 503 },
      );
    }

    if (
      process.env.NODE_ENV === "production" &&
      resolveEmailProvider() === "smtp" &&
      getSmtpDeliveryMode() === "capture"
    ) {
      return NextResponse.json({ error: CAPTURE_SMTP_PRODUCTION_ERROR }, { status: 503 });
    }

    const authOrResponse = await requireCompanyPermission(request, "invite:send");
    if (authOrResponse instanceof NextResponse) return authOrResponse;
    const authCompany = authOrResponse;

    const body = schema.parse(await request.json());
    const normalizedEmails = dedupeEmails(body.emails);
    const emailValidation = validateEmailBatch(normalizedEmails, body.source);
    if (!emailValidation.ok) {
      return NextResponse.json({ error: emailValidation.error }, { status: 400 });
    }

    await ensureCompanyDecoupled(authCompany.companyId);

    const requirementInput = body.requirement;
    let requirement = requirementInput.requirementId
      ? await prisma.requirement.findFirst({
          where: {
            id: requirementInput.requirementId,
            companyId: authCompany.companyId,
            isArchived: false,
          },
          include: { questions: { orderBy: { orderIndex: "asc" } } },
        })
      : null;

    if (requirementInput.requirementId && !requirement) {
      return NextResponse.json({ error: "Requirement not found." }, { status: 404 });
    }

    const normalizedPosition = requirement?.title || requirementInput.positionTitle || "General Role";
    const normalizedDomain = requirement?.domain || requirementInput.domain || normalizedPosition;
    const normalizedTopic =
      requirement?.topic ||
      requirementInput.topic ||
      requirement?.jobDescription ||
      requirementInput.jobDescription ||
      `${normalizedPosition} company interview`;

    const bodyMandatoryFromLines = requirementInput.questions?.map((q) => q.trim()).filter(Boolean) ?? [];
    const bodyOptionalFromLines = requirementInput.optionalQuestions?.map((q) => q.trim()).filter(Boolean) ?? [];
    const resolvedFromBody = resolveMandatoryOptionalQuestions({
      mandatoryQuestions:
        requirementInput.mandatoryQuestions ??
        (bodyMandatoryFromLines.length ? bodyMandatoryFromLines : undefined),
      optionalQuestions:
        requirementInput.optionalQuestionsStructured ??
        (bodyOptionalFromLines.length ? bodyOptionalFromLines : undefined),
      mandatoryIdealAnswers: requirementInput.mandatoryIdealAnswers,
      optionalIdealAnswers: requirementInput.optionalIdealAnswers,
    });

    const normalizedKeySkills = requirement
      ? parseStringArray(requirement.keySkills)
      : (requirementInput.keySkills ?? []).map((s) => s.trim()).filter(Boolean);
    const normalizedJobDescription =
      requirement?.jobDescription ?? (requirementInput.jobDescription?.trim() || null);

    let mandatoryForCreate =
      requirement?.questions.filter((q) => q.isMandatory).length
        ? requirement.questions
            .filter((q) => q.isMandatory)
            .map((q) => ({
              prompt: q.prompt,
              expectedAnswer: q.expectedAnswer,
              gradingRubric: q.gradingRubric,
              difficulty: (q.difficulty as "easy" | "medium" | "hard") ?? "medium",
            }))
        : resolvedFromBody.mandatory.length > 0
          ? resolvedFromBody.mandatory
          : [];

    if (!requirement && mandatoryForCreate.length === 0) {
      mandatoryForCreate = await resolveMandatoryQuestionsForRequirement({
        manualMandatory: [],
        positionTitle: normalizedPosition,
        jobDescription: normalizedJobDescription,
        keySkills: normalizedKeySkills,
        domain: normalizedDomain,
        topic: normalizedTopic,
        durationMin: requirementInput.durationMin,
        maxQuestions: computeMandatoryQuestionCount(requirementInput.durationMin),
      });
    }

    let optionalForCreate =
      requirement?.questions.filter((q) => !q.isMandatory).length
        ? requirement.questions
            .filter((q) => !q.isMandatory)
            .map((q) => ({
              prompt: q.prompt,
              expectedAnswer: q.expectedAnswer,
              gradingRubric: q.gradingRubric,
              difficulty: (q.difficulty as "easy" | "medium" | "hard") ?? "medium",
            }))
        : resolvedFromBody.optional;

    const maxOptionalQuestions = Math.min(
      optionalForCreate.length,
      Math.max(0, requirement?.maxOptionalQuestions ?? requirementInput.maxOptionalQuestions ?? 0),
    );

    const keySkillsDb = keySkillsForDb(normalizedKeySkills);

    if (!requirement) {
      ({ mandatory: mandatoryForCreate, optional: optionalForCreate } = await fillMissingIdealAnswersOnInputs(
        mandatoryForCreate,
        optionalForCreate,
        {
          role: normalizedPosition,
          jobDescription: normalizedJobDescription,
          keySkills: normalizedKeySkills,
          domain: normalizedDomain,
          topic: normalizedTopic,
        },
      ));

      requirement = await prisma.requirement.create({
        data: {
          companyId: authCompany.companyId,
          accessCode: null,
          title: normalizedPosition,
          domain: normalizedDomain,
          topic: normalizedTopic,
          durationMin: requirementInput.durationMin,
          jobDescription: normalizedJobDescription,
          keySkills: keySkillsDb,
          maxOptionalQuestions,
          ...(requirementInput.interviewLanguage &&
          isInterviewLanguageCode(requirementInput.interviewLanguage)
            ? { interviewLanguage: requirementInput.interviewLanguage }
            : {}),
          questions: {
            create: buildNestedRequirementQuestionCreate(mandatoryForCreate, optionalForCreate),
          },
        },
        include: { questions: { orderBy: { orderIndex: "asc" } } },
      });
    }

    const appBaseUrl = getEmailLinkBaseUrl(request);
    const roleTitle = requirement.title ?? requirement.topic;
    const results: InviteDeliveryRow[] = [];

    const verificationResults = await verifyCandidateEmails(emailValidation.emails);
    const verificationByEmail = new Map(verificationResults.map((row) => [row.email, row]));

    let sendIndex = 0;
    for (const email of emailValidation.emails) {
      const verification = verificationByEmail.get(email);
      if (!verification?.valid) {
        results.push({
          email,
          status: "invalid_email",
          verificationMessage: verification?.message ?? "Email could not be verified.",
          deliveryMessage: verification?.message ?? "Incorrect or invalid email — not sent.",
        });
        continue;
      }

      if (sendIndex > 0) {
        await sleep(getEmailSendDelayMs());
      }
      sendIndex += 1;

      let accessCode: string;
      const inviteExpiresAt = createInviteExpiresAt();
      const existingInvite = await prisma.requirementInvite.findUnique({
        where: {
          requirementId_email: {
            requirementId: requirement.id,
            email,
          },
        },
        select: { id: true, accessCode: true },
      });

      if (existingInvite) {
        accessCode = await generateUniqueCandidateInviteCode(authCompany.companyName);
        await prisma.requirementInvite.updateMany({
          where: { id: existingInvite.id, companyId: authCompany.companyId },
          data: {
            accessCode,
            source: "email",
            scheduledAt: null,
            expiresAt: inviteExpiresAt,
            usedAt: null,
          },
        });
      } else {
        accessCode = await generateUniqueCandidateInviteCode(authCompany.companyName);
        await prisma.requirementInvite.create({
          data: {
            requirementId: requirement.id,
            companyId: authCompany.companyId,
            email,
            source: "email",
            accessCode,
            expiresAt: inviteExpiresAt,
          },
        });
      }

      const interviewUrl = `${appBaseUrl}/candidate?code=${encodeURIComponent(accessCode)}`;

      try {
        const sendResult = await sendInterviewInviteEmail({
          to: email,
          companyName: authCompany.companyName,
          roleTitle,
          accessCode,
          interviewUrl,
          expiresAt: inviteExpiresAt,
        });
        const capturedOnly =
          sendResult.provider === "smtp" && sendResult.smtpDeliveryMode === "capture";
        await prisma.requirementInvite.update({
          where: {
            requirementId_email: {
              requirementId: requirement.id,
              email,
            },
          },
          data: {
            emailSentAt: capturedOnly ? null : new Date(),
            expiresAt: inviteExpiresAt,
            usedAt: null,
          },
        });
        results.push({
          email,
          accessCode,
          status: capturedOnly ? "captured_dev" : "sent",
          verificationMessage: verification.message,
          deliveryMessage: capturedOnly
            ? `${CAPTURE_SMTP_DEV_NOTE} ${SPAM_FOLDER_NOTE}`
            : `Sent successfully. ${SPAM_FOLDER_NOTE}`,
        });
      } catch (sendError) {
        const message = sendError instanceof Error ? sendError.message : "Unable to send email.";
        const status = classifySmtpError(message);
        const sesIamBlocked = /not authorized to perform `ses:SendEmail`|ses:SendEmail/i.test(message);
        const retryable =
          status === "rate_limited" || status === "send_failed" || status === "sandbox_restricted";
        if (retryable) {
          try {
            await enqueueInterviewInviteEmail(
              prisma,
              {
                to: email,
                companyName: authCompany.companyName,
                roleTitle,
                accessCode,
                interviewUrl,
                expiresAt: inviteExpiresAt,
              },
              message,
            );
          } catch (enqueueError) {
            console.error("[invite-candidates] email outbox enqueue failed:", enqueueError);
          }
        }
        results.push({
          email,
          accessCode,
          status,
          verificationMessage: verification.message,
          deliveryMessage:
            sesIamBlocked
              ? `Not delivered — ${SES_IAM_NOTE} (${message})`
              : isSmtpAuthError(message)
                ? `Not delivered — ${SMTP_AUTH_NOTE}`
                : status === "invalid_email"
                ? `Incorrect email — mail server rejected this address. (${message})`
                : status === "sandbox_restricted"
                  ? `Not delivered — ${SES_SANDBOX_NOTE} (${message})`
                  : retryable
                    ? `${message} (queued for automatic retry)`
                    : message,
        });
      }
    }

    const summary = buildInviteDeliverySummary(results);

    await writePlatformAuditLog(prisma, {
      level: summary.failed > 0 ? "WARNING" : "INFO",
      category: "INVITE",
      title: "Candidate invites sent",
      message: `Company ${authCompany.companyName}: sent=${summary.sent}, failed=${summary.failed}, invalid=${summary.invalid} for requirement ${requirement.id}.`,
      metadata: {
        companyId: authCompany.companyId,
        requirementId: requirement.id,
        sent: String(summary.sent),
        failed: String(summary.failed),
        invalid: String(summary.invalid),
      },
    });

    return NextResponse.json({
      requirementId: requirement.id,
      sentCount: summary.sent,
      failedCount: summary.failed,
      invalidCount: summary.invalid,
      summary,
      spamFolderNote: SPAM_FOLDER_NOTE,
      invites: results,
      interviewUrl: `${appBaseUrl}/candidate`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    console.error("[admin/requirements/invite-candidates POST]", error);
    return NextResponse.json({ error: "Unable to send candidate invites." }, { status: 500 });
  }
}
