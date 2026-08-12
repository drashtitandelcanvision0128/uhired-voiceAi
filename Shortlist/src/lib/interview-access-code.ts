import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const requirementInclude = {
  questions: { orderBy: { orderIndex: "asc" as const } },
} satisfies Prisma.RequirementInclude;

export type InterviewAccessLookup = {
  invite: Prisma.RequirementInviteGetPayload<{
    include: { requirement: { include: typeof requirementInclude } };
  }> | null;
  requirement: Prisma.RequirementGetPayload<{ include: typeof requirementInclude }> | null;
};

export async function lookupInterviewByAccessCode(accessCode: string): Promise<InterviewAccessLookup> {
  const normalizedCode = accessCode.trim();
  if (!normalizedCode) {
    return { invite: null, requirement: null };
  }

  const invite = await prisma.requirementInvite.findFirst({
    where: { accessCode: { equals: normalizedCode, mode: "insensitive" } },
    include: {
      requirement: {
        include: requirementInclude,
      },
    },
  });

  let requirement = invite?.requirement ?? null;
  if (!requirement) {
    requirement = await prisma.requirement.findFirst({
      where: {
        accessCode: { equals: normalizedCode, mode: "insensitive" },
        isArchived: false,
      },
      include: requirementInclude,
    });
  }

  return { invite, requirement };
}
