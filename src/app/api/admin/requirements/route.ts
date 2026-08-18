import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCompanyAdminSessionFromCookieHeader } from "@/lib/company-admin-auth";
import { ensureCompanyDecoupled } from "@/lib/decouple-backfill";
import { formatInterviewDurationShort, computeMandatoryQuestionCount } from "@/lib/interview-duration";
import { generateAccessCode } from "@/lib/codes";
import { questionInputSchema } from "@/lib/interview-questions";
import { fillMissingIdealAnswersOnInputs } from "@/lib/generate-ideal-answers";
import { resolveMandatoryQuestionsForRequirement } from "@/lib/resolve-requirement-questions";
import { isInterviewLanguageCode } from "@/lib/interview-languages";
import {
  buildNestedRequirementQuestionCreate,
  mapRequirementQuestionsForAdmin,
  resolveMandatoryOptionalQuestions,
} from "@/lib/requirement-question-payload";

const schema = z.object({
  title: z.string().trim().optional(),
  domain: z.string().trim().min(1),
  topic: z.string().trim().min(1),
  durationMin: z.coerce.number().int().min(5).max(120),
  jobDescription: z.string().trim().optional(),
  keySkills: z.array(z.string().trim().min(1)).optional(),
  maxOptionalQuestions: z.coerce.number().int().min(0).max(20).optional(),
  mandatoryQuestions: z.array(questionInputSchema).max(5).optional(),
  optionalQuestions: z.array(questionInputSchema).optional(),
  mandatoryIdealAnswers: z.string().optional(),
  optionalIdealAnswers: z.string().optional(),
  interviewLanguage: z.string().trim().optional(),
});

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 200;

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildRequirementWhere(companyId: string, search: string): Prisma.RequirementWhereInput {
  const base: Prisma.RequirementWhereInput = {
    companyId,
    isArchived: false,
  };

  const trimmed = search.trim();
  if (!trimmed) return base;

  return {
    ...base,
    OR: [
      { title: { contains: trimmed, mode: "insensitive" } },
      { domain: { contains: trimmed, mode: "insensitive" } },
      { topic: { contains: trimmed, mode: "insensitive" } },
      { accessCode: { contains: trimmed, mode: "insensitive" } },
      {
        invites: {
          some: { accessCode: { contains: trimmed, mode: "insensitive" } },
        },
      },
    ],
  };
}

type InviteStatRow = {
  usedAt: Date | null;
  emailSentAt: Date | null;
  expiresAt: Date | null;
};

function computeInviteStats(invites: InviteStatRow[]) {
  const now = Date.now();
  let used = 0;
  let sent = 0;
  let expired = 0;

  for (const invite of invites) {
    if (invite.usedAt) {
      used += 1;
      continue;
    }
    const expiresMs = invite.expiresAt?.getTime();
    if (expiresMs != null && Number.isFinite(expiresMs) && expiresMs <= now) {
      expired += 1;
      continue;
    }
    if (invite.emailSentAt) sent += 1;
  }

  return { used, sent, expired };
}

export async function GET(request: Request) {
  const authCompany = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!authCompany) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureCompanyDecoupled(authCompany.companyId);

  const { searchParams } = new URL(request.url);
  const page = parsePositiveInt(searchParams.get("page"), 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE));
  const search = searchParams.get("search") ?? "";
  const where = buildRequirementWhere(authCompany.companyId, search);

  const [total, requirements, companyInvites] = await Promise.all([
    prisma.requirement.count({ where }),
    prisma.requirement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { questions: { orderBy: { orderIndex: "asc" } }, _count: { select: { sessions: true } } },
    }),
    prisma.requirementInvite.findMany({
      where: {
        companyId: authCompany.companyId,
        requirement: { isArchived: false },
      },
      select: { usedAt: true, emailSentAt: true, expiresAt: true },
    }),
  ]);

  const inviteStats = computeInviteStats(companyInvites);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const requirementIds = requirements.map((r) => r.id);
  const [linkedSessions, requirementInvites] = await Promise.all([
    requirementIds.length > 0
      ? prisma.interviewSession.findMany({
          where: {
            companyId: authCompany.companyId,
            sessionType: "COMPANY",
            requirementId: { in: requirementIds },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            requirementId: true,
            candidateName: true,
            candidateEmail: true,
            status: true,
            startedAt: true,
            endedAt: true,
            durationMin: true,
            createdAt: true,
            scorecard: { select: { overallScore: true } },
          },
        })
      : Promise.resolve([]),
    requirementIds.length > 0
      ? prisma.requirementInvite.findMany({
          where: {
            companyId: authCompany.companyId,
            requirementId: { in: requirementIds },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            requirementId: true,
            email: true,
            candidateName: true,
            source: true,
            accessCode: true,
            scheduledAt: true,
            emailSentAt: true,
            usedAt: true,
            expiresAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const inviteEmails = [...new Set(requirementInvites.map((invite) => invite.email))];
  const candidateNames =
    inviteEmails.length > 0
      ? await prisma.candidate.findMany({
          where: {
            companyId: authCompany.companyId,
            email: { in: inviteEmails },
            isArchived: false,
          },
          select: { email: true, name: true },
        })
      : [];
  const candidateNameByEmail = new Map(
    candidateNames.flatMap((row) =>
      row.email ? [[row.email.toLowerCase(), row.name] as const] : [],
    ),
  );

  const interviewsByRequirement = new Map<string, typeof linkedSessions>();
  for (const row of linkedSessions) {
    if (!row.requirementId) continue;
    const bucket = interviewsByRequirement.get(row.requirementId) ?? [];
    bucket.push(row);
    interviewsByRequirement.set(row.requirementId, bucket);
  }

  const invitesByRequirement = new Map<string, typeof requirementInvites>();
  for (const invite of requirementInvites) {
    const bucket = invitesByRequirement.get(invite.requirementId) ?? [];
    bucket.push(invite);
    invitesByRequirement.set(invite.requirementId, bucket);
  }

  const payload = requirements.map((r) => ({
    requirementId: r.id,
    title: r.title,
    domain: r.domain,
    topic: r.topic,
    durationMin: r.durationMin,
    jobDescription: r.jobDescription,
    keySkills: r.keySkills,
    maxOptionalQuestions: r.maxOptionalQuestions,
    ...mapRequirementQuestionsForAdmin(r.questions),
    sessionsCount: r._count.sessions,
    requirementAccessCode: r.accessCode ?? null,
    candidateInvites: (invitesByRequirement.get(r.id) ?? []).map((invite) => ({
      id: invite.id,
      email: invite.email,
      candidateName:
        invite.candidateName ?? candidateNameByEmail.get(invite.email.toLowerCase()) ?? null,
      source: invite.source,
      accessCode: invite.accessCode,
      scheduledAt: invite.scheduledAt?.toISOString() ?? null,
      emailSentAt: invite.emailSentAt?.toISOString() ?? null,
      usedAt: invite.usedAt?.toISOString() ?? null,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
    })),
    createdAt: r.createdAt,
    linkedInterviews: (interviewsByRequirement.get(r.id) ?? []).map((s) => ({
      sessionId: s.id,
      candidateName: s.candidateName,
      candidateEmail: s.candidateEmail,
      status: s.status,
      overallScore: s.scorecard?.overallScore ?? null,
      interviewDurationDisplay: formatInterviewDurationShort({
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        durationMin: s.durationMin,
      }),
      createdAt: s.createdAt.toISOString(),
    })),
  }));

  return NextResponse.json({
    requirements: payload,
    inviteStats,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  });
}

export async function POST(request: Request) {
  const authCompany = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!authCompany) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = schema.parse(await request.json());
    let { mandatory, optional } = resolveMandatoryOptionalQuestions(body);

    if (mandatory.length === 0) {
      mandatory = await resolveMandatoryQuestionsForRequirement({
        manualMandatory: [],
        positionTitle: body.title?.trim() || body.domain,
        jobDescription: body.jobDescription,
        keySkills: body.keySkills,
        domain: body.domain,
        topic: body.topic,
        maxQuestions: computeMandatoryQuestionCount(body.durationMin),
      });
    }

    ({ mandatory, optional } = await fillMissingIdealAnswersOnInputs(mandatory, optional, {
      role: body.title?.trim() || body.domain,
      jobDescription: body.jobDescription,
      keySkills: body.keySkills,
      domain: body.domain,
      topic: body.topic,
    }));
    const maxOptionalQuestions = Math.min(optional.length, Math.max(0, body.maxOptionalQuestions ?? 0));
    let requirementAccessCode = generateAccessCode("REQ");
    while (await prisma.requirement.findUnique({ where: { accessCode: requirementAccessCode }, select: { id: true } })) {
      requirementAccessCode = generateAccessCode("REQ");
    }
    const requirement = await prisma.requirement.create({
      data: {
        companyId: authCompany.companyId,
        accessCode: requirementAccessCode,
        title: body.title?.trim() || null,
        domain: body.domain.trim(),
        topic: body.topic.trim(),
        durationMin: body.durationMin,
        jobDescription: body.jobDescription?.trim() || null,
        keySkills: body.keySkills?.length ? body.keySkills.map((s) => s.trim()) : undefined,
        maxOptionalQuestions,
        ...(body.interviewLanguage && isInterviewLanguageCode(body.interviewLanguage)
          ? { interviewLanguage: body.interviewLanguage }
          : {}),
        questions: {
          create: buildNestedRequirementQuestionCreate(mandatory, optional),
        },
      },
    });
    return NextResponse.json({ ok: true, requirementId: requirement.id, accessCode: requirement.accessCode });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create requirement." }, { status: 500 });
  }
}
