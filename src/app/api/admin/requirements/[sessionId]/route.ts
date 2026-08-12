import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompanyAdminSessionFromCookieHeader } from "@/lib/company-admin-auth";
import { questionInputSchema } from "@/lib/interview-questions";
import { fillMissingIdealAnswersOnInputs } from "@/lib/generate-ideal-answers";
import {
  buildRequirementQuestionRows,
  resolveMandatoryOptionalQuestions,
} from "@/lib/requirement-question-payload";

type Context = {
  params: Promise<{ sessionId: string }>;
};

const patchSchema = z.object({
  title: z.string().trim().optional(),
  domain: z.string().trim().min(1).optional(),
  topic: z.string().trim().min(1).optional(),
  durationMin: z.coerce.number().int().min(5).max(120).optional(),
  jobDescription: z.string().trim().optional(),
  keySkills: z.array(z.string().trim().min(1)).optional(),
  maxOptionalQuestions: z.coerce.number().int().min(0).max(20).optional(),
  mandatoryQuestions: z.array(questionInputSchema).max(5).optional(),
  optionalQuestions: z.array(questionInputSchema).optional(),
  mandatoryIdealAnswers: z.string().optional(),
  optionalIdealAnswers: z.string().optional(),
});

export async function PATCH(request: Request, context: Context) {
  const authCompany = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!authCompany) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId: requirementId } = await context.params;
  try {
    const body = patchSchema.parse(await request.json());
    const existing = await prisma.requirement.findFirst({
      where: { id: requirementId, companyId: authCompany.companyId, isArchived: false },
      include: { questions: { orderBy: { orderIndex: "asc" } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Requirement not found." }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title || null;
    if (body.domain !== undefined) updates.domain = body.domain;
    if (body.topic !== undefined) updates.topic = body.topic;
    if (body.durationMin !== undefined) updates.durationMin = body.durationMin;
    if (body.jobDescription !== undefined) updates.jobDescription = body.jobDescription || null;
    if (body.keySkills !== undefined) updates.keySkills = body.keySkills.length ? body.keySkills : null;

    const shouldReplaceQuestions =
      body.mandatoryQuestions !== undefined ||
      body.optionalQuestions !== undefined ||
      body.mandatoryIdealAnswers !== undefined ||
      body.optionalIdealAnswers !== undefined;
    if (body.maxOptionalQuestions !== undefined) {
      const optionalCount = existing.questions.filter((q) => !q.isMandatory).length;
      updates.maxOptionalQuestions = Math.min(optionalCount, body.maxOptionalQuestions);
    } else if (body.optionalQuestions !== undefined || body.optionalIdealAnswers !== undefined) {
      const optionalCount = resolveMandatoryOptionalQuestions({
        optionalQuestions: body.optionalQuestions,
        optionalIdealAnswers: body.optionalIdealAnswers,
      }).optional.length;
      updates.maxOptionalQuestions = Math.min(existing.maxOptionalQuestions, optionalCount);
    }

    let questionRows: Prisma.RequirementQuestionCreateManyInput[] | null = null;
    if (shouldReplaceQuestions) {
      let mandatorySource =
        body.mandatoryQuestions !== undefined || body.mandatoryIdealAnswers !== undefined
          ? resolveMandatoryOptionalQuestions({
              mandatoryQuestions: body.mandatoryQuestions,
              mandatoryIdealAnswers: body.mandatoryIdealAnswers,
            }).mandatory
          : existing.questions
              .filter((q) => q.isMandatory)
              .map((q) => ({
                prompt: q.prompt,
                expectedAnswer: q.expectedAnswer,
                gradingRubric: q.gradingRubric,
                difficulty: (q.difficulty as "easy" | "medium" | "hard") ?? "medium",
              }));
      let optionalSource =
        body.optionalQuestions !== undefined || body.optionalIdealAnswers !== undefined
          ? resolveMandatoryOptionalQuestions({
              optionalQuestions: body.optionalQuestions,
              optionalIdealAnswers: body.optionalIdealAnswers,
            }).optional
          : existing.questions
              .filter((q) => !q.isMandatory)
              .map((q) => ({
                prompt: q.prompt,
                expectedAnswer: q.expectedAnswer,
                gradingRubric: q.gradingRubric,
                difficulty: (q.difficulty as "easy" | "medium" | "hard") ?? "medium",
              }));
      const idealContext = {
        role: (body.title ?? existing.title ?? body.domain ?? existing.domain).trim(),
        jobDescription: body.jobDescription ?? existing.jobDescription,
        keySkills: body.keySkills ?? undefined,
        domain: body.domain ?? existing.domain,
        topic: body.topic ?? existing.topic,
      };
      const filled = await fillMissingIdealAnswersOnInputs(
        mandatorySource,
        optionalSource,
        idealContext,
      );
      mandatorySource = filled.mandatory;
      optionalSource = filled.optional;
      questionRows = buildRequirementQuestionRows(
        existing.id,
        mandatorySource,
        optionalSource,
      ) as Prisma.RequirementQuestionCreateManyInput[];
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updates).length > 0) {
        await tx.requirement.update({ where: { id: existing.id }, data: updates });
      }
      if (questionRows) {
        await tx.requirementQuestion.deleteMany({ where: { requirementId: existing.id } });
        await tx.requirementQuestion.createMany({ data: questionRows });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update requirement." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const authCompany = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!authCompany) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId: requirementId } = await context.params;
  const existing = await prisma.requirement.findFirst({
    where: {
      id: requirementId,
      companyId: authCompany.companyId,
      isArchived: false,
    },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Requirement not found." }, { status: 404 });
  }

  await prisma.requirement.update({
    where: { id: existing.id },
    data: { isArchived: true },
  });

  return NextResponse.json({ ok: true });
}
