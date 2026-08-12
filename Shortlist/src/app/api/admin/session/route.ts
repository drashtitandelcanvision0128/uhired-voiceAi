import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateAccessCode } from "@/lib/codes";
import { ensureCompanyDecoupled } from "@/lib/decouple-backfill";
import { keySkillsForDb } from "@/lib/session-key-skills";
import {
  getCompanyAdminSessionFromCookieHeader,
  hasCompanyAdminSessionFromCookieHeader,
} from "@/lib/company-admin-auth";
import { questionInputSchema } from "@/lib/interview-questions";
import { fillMissingIdealAnswersOnInputs } from "@/lib/generate-ideal-answers";
import { resolveMandatoryQuestionsForRequirement } from "@/lib/resolve-requirement-questions";
import { computeMandatoryQuestionCount } from "@/lib/interview-duration";
import {
  buildNestedRequirementQuestionCreate,
  resolveMandatoryOptionalQuestions,
} from "@/lib/requirement-question-payload";

const schema = z.object({
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
});

export const maxDuration = 120;

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
    const body = schema.parse(await request.json());
    const hasSession = await hasCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
    if (!hasSession) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const authCompany = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
    if (!authCompany) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await ensureCompanyDecoupled(authCompany.companyId);
    } catch (backfillError) {
      console.error("[admin/session POST] ensureCompanyDecoupled failed:", backfillError);
    }

    let requirement = body.requirementId
      ? await prisma.requirement.findFirst({
          where: { id: body.requirementId, companyId: authCompany.companyId, isArchived: false },
          include: { questions: { orderBy: { orderIndex: "asc" } } },
        })
      : null;
    if (body.requirementId && !requirement) {
      return NextResponse.json({ error: "Requirement not found." }, { status: 404 });
    }

    const normalizedCompany = authCompany.companyName;
    const normalizedPosition = requirement?.title || body.positionTitle || "General Role";
    const normalizedDomain = requirement?.domain || body.domain || normalizedPosition;
    const normalizedTopic =
      requirement?.topic ||
      body.topic ||
      requirement?.jobDescription ||
      body.jobDescription ||
      `${normalizedPosition} company interview`;

    const bodyMandatoryFromLines = body.questions?.map((q) => q.trim()).filter(Boolean) ?? [];
    const bodyOptionalFromLines = body.optionalQuestions?.map((q) => q.trim()).filter(Boolean) ?? [];
    const resolvedFromBody = resolveMandatoryOptionalQuestions({
      mandatoryQuestions:
        body.mandatoryQuestions ??
        (bodyMandatoryFromLines.length ? bodyMandatoryFromLines : undefined),
      optionalQuestions:
        body.optionalQuestionsStructured ??
        (bodyOptionalFromLines.length ? bodyOptionalFromLines : undefined),
      mandatoryIdealAnswers: body.mandatoryIdealAnswers,
      optionalIdealAnswers: body.optionalIdealAnswers,
    });
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
      Math.max(0, requirement?.maxOptionalQuestions ?? body.maxOptionalQuestions ?? 0),
    );
    const normalizedKeySkills = requirement
      ? parseStringArray(requirement.keySkills)
      : (body.keySkills ?? []).map((s) => s.trim()).filter(Boolean);
    const normalizedJobDescription =
      requirement?.jobDescription ?? (body.jobDescription?.trim() || null);

    if (!requirement && mandatoryForCreate.length === 0) {
      mandatoryForCreate = await resolveMandatoryQuestionsForRequirement({
        manualMandatory: [],
        positionTitle: normalizedPosition,
        jobDescription: normalizedJobDescription,
        keySkills: normalizedKeySkills,
        domain: normalizedDomain,
        topic: normalizedTopic,
        durationMin: body.durationMin,
        maxQuestions: computeMandatoryQuestionCount(body.durationMin),
      });
    }

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
    }

    if (!requirement) {
      let requirementAccessCode = generateAccessCode("REQ");
      while (
        await prisma.requirement.findUnique({ where: { accessCode: requirementAccessCode }, select: { id: true } })
      ) {
        requirementAccessCode = generateAccessCode("REQ");
      }
      const createdRequirement = await prisma.requirement.create({
        data: {
          companyId: authCompany.companyId,
          accessCode: requirementAccessCode,
          title: normalizedPosition,
          domain: normalizedDomain,
          topic: normalizedTopic,
          durationMin: body.durationMin,
          jobDescription: normalizedJobDescription,
          keySkills: keySkillsDb,
          maxOptionalQuestions,
          questions: {
            create: buildNestedRequirementQuestionCreate(mandatoryForCreate, optionalForCreate),
          },
        },
        include: { questions: { orderBy: { orderIndex: "asc" } } },
      });
      requirement = createdRequirement;
    }

    return NextResponse.json({
      requirementId: requirement.id,
      accessCode: requirement.accessCode,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0];
      const field =
        firstIssue?.path && firstIssue.path.length > 0
          ? String(firstIssue.path[0])
          : "request";
      return NextResponse.json(
        { error: `Invalid ${field}: ${firstIssue?.message ?? "check input."}` },
        { status: 400 },
      );
    }
    console.error("[admin/session POST]", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const hint =
        error.code === "P2021" || error.message.includes("does not exist")
          ? "Database schema is out of date. Run prisma migrate deploy on the server."
          : undefined;
      return NextResponse.json(
        { error: "Unable to generate requirement.", hint },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "Unable to generate requirement." }, { status: 500 });
  }
}
