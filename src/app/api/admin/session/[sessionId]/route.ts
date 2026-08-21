import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCompanyAdminSessionFromCookieHeader } from "@/lib/company-admin-auth";
import { deleteInterviewVideoAssets, getInterviewVideoInfo } from "@/lib/interview-video-storage";
import { questionInputSchema } from "@/lib/interview-questions";
import { buildQuestionCreateRows } from "@/lib/interview-questions";
import { resolveMandatoryOptionalQuestions } from "@/lib/requirement-question-payload";
import { formatInterviewDuration } from "@/lib/interview-duration";
import { parseQuestionResultsFromScorecard } from "@/lib/parse-question-results";
import { resolveCandidateInviteCode, buildCandidateInviteCodeMap } from "@/lib/requirement-invite-lookup";
import { resolveSessionCandidateDisplay } from "@/lib/candidate-session-display";
import { syncCandidateFromSession } from "@/lib/candidate-session-sync.server";

type Context = {
  params: Promise<{ sessionId: string }>;
};

const patchSchema = z.object({
  positionTitle: z.string().trim().min(1).optional(),
  domain: z.string().trim().min(1).optional(),
  topic: z.string().trim().min(1).optional(),
  durationMin: z.coerce.number().int().min(5).max(120).optional(),
  candidateName: z.string().trim().min(1).optional(),
  candidateEmail: z.string().trim().email().optional(),
  jobDescription: z.string().trim().optional(),
  keySkills: z.array(z.string().trim().min(1)).optional(),
  mandatoryQuestions: z.array(questionInputSchema).max(5).optional(),
  optionalQuestions: z.array(questionInputSchema).optional(),
  mandatoryIdealAnswers: z.string().optional(),
  optionalIdealAnswers: z.string().optional(),
  maxOptionalQuestions: z.coerce.number().int().min(0).max(20).optional(),
});

export async function GET(request: Request, context: Context) {
  const { sessionId } = await context.params;
  const authCompany = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!authCompany) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, companyId: authCompany.companyId },
    include: {
      questions: { orderBy: { orderIndex: "asc" } },
      transcript: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] },
      scorecard: true,
      requirement: { select: { accessCode: true } },
      candidate: { select: { id: true, name: true, email: true } },
      scoringJobs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const invites =
    session.requirementId && session.candidateEmail
      ? await prisma.requirementInvite.findMany({
          where: {
            companyId: authCompany.companyId,
            requirementId: session.requirementId,
            email: session.candidateEmail.toLowerCase(),
          },
          select: { requirementId: true, email: true, accessCode: true },
        })
      : [];
  const candidateInviteCode = resolveCandidateInviteCode(
    buildCandidateInviteCodeMap(invites),
    session.requirementId,
    session.candidateEmail,
  );

  const videoInfo = await getInterviewVideoInfo(sessionId);
  const scorecard = session.scorecard
    ? {
        ...session.scorecard,
        questionResults: parseQuestionResultsFromScorecard(session.scorecard.questionResults),
      }
    : null;

  const display = resolveSessionCandidateDisplay(session);

  return NextResponse.json({
    session: {
      ...session,
      candidateName: display.candidateName,
      candidateEmail: display.candidateEmail,
      scorecard,
      interviewDurationDisplay: formatInterviewDuration({
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationMin: session.durationMin,
        videoDurationSec: videoInfo.videoDurationSec,
      }),
      questions: session.questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        isMandatory: q.isMandatory,
        expectedAnswer: q.expectedAnswer,
        difficulty: q.difficulty,
      })),
      requirementAccessCode: session.requirement?.accessCode ?? null,
      candidateInviteCode,
      videoFilePath: videoInfo.videoFilePath,
      videoDurationSec: videoInfo.videoDurationSec,
      videoUploadedAt: videoInfo.videoUploadedAt,
      videoRecordingStatus: videoInfo.videoRecordingStatus,
      scoringJobStatus: session.scoringJobs[0]?.status ?? null,
    },
  });
}

export async function PATCH(request: Request, context: Context) {
  const { sessionId } = await context.params;
  const authCompany = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!authCompany) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = patchSchema.parse(await request.json());
    const existing = await prisma.interviewSession.findFirst({
      where: {
        id: sessionId,
        companyId: authCompany.companyId,
        sessionType: "COMPANY",
      },
      include: { questions: { orderBy: { orderIndex: "asc" } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const isCompleted = existing.status === "COMPLETED";
    const hasCandidateEdit = body.candidateName !== undefined || body.candidateEmail !== undefined;
    const hasNonCandidateEdit =
      body.positionTitle !== undefined ||
      body.domain !== undefined ||
      body.topic !== undefined ||
      body.durationMin !== undefined ||
      body.jobDescription !== undefined ||
      body.keySkills !== undefined ||
      body.mandatoryQuestions !== undefined ||
      body.optionalQuestions !== undefined ||
      body.mandatoryIdealAnswers !== undefined ||
      body.optionalIdealAnswers !== undefined ||
      body.maxOptionalQuestions !== undefined;

    if (isCompleted && hasNonCandidateEdit) {
      return NextResponse.json({ error: "Completed sessions can only update candidate name or email." }, { status: 409 });
    }
    if (isCompleted && !hasCandidateEdit) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    if (isCompleted && hasCandidateEdit) {
      const nextData: { candidateName?: string; candidateEmail?: string } = {};
      if (body.candidateName !== undefined) nextData.candidateName = body.candidateName;
      if (body.candidateEmail !== undefined) nextData.candidateEmail = body.candidateEmail.toLowerCase();
      await prisma.$transaction(async (tx) => {
        await tx.interviewSession.update({ where: { id: existing.id }, data: nextData });
        await syncCandidateFromSession(tx, existing.candidateId, {
          ...nextData,
          companyId: authCompany.companyId,
        });
      });
      return NextResponse.json({ ok: true });
    }

    const nextData: Record<string, unknown> = {};
    if (body.positionTitle !== undefined) nextData.positionTitle = body.positionTitle;
    if (body.domain !== undefined) nextData.domain = body.domain;
    if (body.topic !== undefined) nextData.topic = body.topic;
    if (body.durationMin !== undefined) nextData.durationMin = body.durationMin;
    if (body.candidateName !== undefined) nextData.candidateName = body.candidateName;
    if (body.candidateEmail !== undefined) nextData.candidateEmail = body.candidateEmail.toLowerCase();
    if (body.jobDescription !== undefined) nextData.jobDescription = body.jobDescription || null;
    if (body.keySkills !== undefined) {
      const normalized = body.keySkills.map((s) => s.trim()).filter(Boolean);
      nextData.keySkills = normalized.length ? normalized : null;
    }

    const shouldReplaceQuestions =
      body.mandatoryQuestions !== undefined ||
      body.optionalQuestions !== undefined ||
      body.mandatoryIdealAnswers !== undefined ||
      body.optionalIdealAnswers !== undefined;
    if (body.maxOptionalQuestions !== undefined) {
      const optionalCount = existing.questions.filter((q) => !q.isMandatory).length;
      nextData.maxOptionalQuestions = Math.min(optionalCount, body.maxOptionalQuestions);
    } else if (body.optionalQuestions !== undefined || body.optionalIdealAnswers !== undefined) {
      const optionalCount = resolveMandatoryOptionalQuestions({
        optionalQuestions: body.optionalQuestions,
        optionalIdealAnswers: body.optionalIdealAnswers,
      }).optional.length;
      nextData.maxOptionalQuestions = Math.min(existing.maxOptionalQuestions, optionalCount);
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(nextData).length > 0) {
        await tx.interviewSession.update({
          where: { id: existing.id },
          data: nextData,
        });
      }
      if (body.candidateName !== undefined || body.candidateEmail !== undefined) {
        await syncCandidateFromSession(tx, existing.candidateId, {
          candidateName: body.candidateName,
          candidateEmail: body.candidateEmail,
          companyId: authCompany.companyId,
        });
      }

      if (shouldReplaceQuestions) {
        const mandatorySource =
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
        const optionalSource =
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
        await tx.interviewQuestion.deleteMany({ where: { sessionId: existing.id } });
        await tx.interviewQuestion.createMany({
          data: [
            ...buildQuestionCreateRows(mandatorySource, { sessionId: existing.id }, true, 0),
            ...buildQuestionCreateRows(
              optionalSource,
              { sessionId: existing.id },
              false,
              mandatorySource.length,
            ),
          ] as Prisma.InterviewQuestionCreateManyInput[],
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update session." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const { sessionId } = await context.params;
  const authCompany = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!authCompany) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.interviewSession.findFirst({
    where: {
      id: sessionId,
      companyId: authCompany.companyId,
      sessionType: "COMPANY",
    },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  await deleteInterviewVideoAssets(existing.id);

  await prisma.$transaction(async (tx) => {
    await tx.interviewTurn.deleteMany({ where: { sessionId: existing.id } });
    await tx.scorecard.deleteMany({ where: { sessionId: existing.id } });
    await tx.interviewQuestion.deleteMany({ where: { sessionId: existing.id } });
    await tx.interviewSession.delete({
      where: { id: existing.id },
    });
  });
  return NextResponse.json({ ok: true });
}
