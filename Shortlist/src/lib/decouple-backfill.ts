import { prisma } from "@/lib/prisma";
import { generateAccessCode } from "@/lib/codes";
import { keySkillsForDb, resolveSessionKeySkills } from "@/lib/session-key-skills";

export async function ensureCompanyDecoupled(companyId: string) {
  const requirementsMissingCode = await prisma.requirement.findMany({
    where: { companyId, accessCode: null },
    select: { id: true },
    take: 500,
  });
  for (const requirement of requirementsMissingCode) {
    let requirementAccessCode = generateAccessCode("REQ");
    while (
      await prisma.requirement.findUnique({ where: { accessCode: requirementAccessCode }, select: { id: true } })
    ) {
      requirementAccessCode = generateAccessCode("REQ");
    }
    await prisma.requirement.update({
      where: { id: requirement.id },
      data: { accessCode: requirementAccessCode },
    });
  }

  const sessions = await prisma.interviewSession.findMany({
    where: { companyId, sessionType: "COMPANY" },
    include: {
      questions: { orderBy: { orderIndex: "asc" } },
      requirement: { select: { keySkills: true } },
    },
    take: 500,
  });

  for (const session of sessions) {
    let requirementId = session.requirementId;
    if (!requirementId) {
      let requirementAccessCode = generateAccessCode("REQ");
      while (
        await prisma.requirement.findUnique({ where: { accessCode: requirementAccessCode }, select: { id: true } })
      ) {
        requirementAccessCode = generateAccessCode("REQ");
      }
      const requirement = await prisma.requirement.create({
        data: {
          companyId,
          accessCode: requirementAccessCode,
          title: session.positionTitle || session.topic || "Interview Requirement",
          domain: session.domain,
          topic: session.topic,
          durationMin: session.durationMin,
          jobDescription: session.jobDescription,
          keySkills: session.keySkills ?? undefined,
          maxOptionalQuestions: session.maxOptionalQuestions,
          isArchived: session.requirementArchivedAt ? true : false,
          questions: {
            create: session.questions.map((q) => ({
              prompt: q.prompt,
              orderIndex: q.orderIndex,
              isMandatory: q.isMandatory,
            })),
          },
        },
      });
      requirementId = requirement.id;
    }

    let candidateId = session.candidateId;
    if (!candidateId && (session.candidateEmail || session.candidateName)) {
      const normalizedEmail = session.candidateEmail?.toLowerCase() ?? null;
      const byEmail = normalizedEmail
        ? await prisma.candidate.findFirst({
            where: { companyId, email: normalizedEmail },
            select: { id: true },
          })
        : null;
      const byNameOnly =
        !byEmail && session.candidateName
          ? await prisma.candidate.findFirst({
              where: { companyId, email: null, name: session.candidateName },
              select: { id: true },
            })
          : null;
      const candidate =
        byEmail || byNameOnly
          ? { id: (byEmail || byNameOnly)!.id }
          : await prisma.candidate.create({
              data: {
                companyId,
                name: session.candidateName || "Candidate",
                email: normalizedEmail,
                isArchived: false,
              },
              select: { id: true },
            });
      candidateId = candidate.id;
    }

    const patch: {
      requirementId?: string | null;
      candidateId?: string | null;
      keySkills?: string[];
    } = {};

    if (session.requirementId !== requirementId) {
      patch.requirementId = requirementId ?? null;
    }
    if (session.candidateId !== candidateId) {
      patch.candidateId = candidateId ?? null;
    }

    const resolvedKeySkills = resolveSessionKeySkills(session, session.requirement);
    if (!resolveSessionKeySkills(session, null).length && resolvedKeySkills.length > 0) {
      const dbSkills = keySkillsForDb(resolvedKeySkills);
      if (dbSkills) patch.keySkills = dbSkills;
    }

    if (Object.keys(patch).length > 0) {
      await prisma.interviewSession.update({
        where: { id: session.id },
        data: patch,
      });
    }
  }
}
