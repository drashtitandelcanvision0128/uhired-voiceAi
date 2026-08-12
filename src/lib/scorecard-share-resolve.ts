import { prisma } from "@/lib/prisma";
import { hashRawScorecardShareToken } from "@/lib/scorecard-share-token";
import type {
  Candidate,
  Company,
  InterviewSession,
  Requirement,
  Scorecard,
  ScorecardShareLink,
} from "@prisma/client";

export type ActiveScorecardShareLink = ScorecardShareLink & {
  session: InterviewSession & {
    scorecard: Scorecard;
    candidate: Candidate | null;
    company: Company | null;
    requirement: Requirement | null;
  };
};

export async function findActiveScorecardShareByRawToken(
  rawToken: string | undefined | null,
): Promise<ActiveScorecardShareLink | null> {
  const trimmed = rawToken?.trim();
  if (!trimmed) {
    return null;
  }
  const tokenHash = await hashRawScorecardShareToken(trimmed);
  const link = await prisma.scorecardShareLink.findUnique({
    where: { tokenHash },
    include: {
      session: {
        include: {
          scorecard: true,
          candidate: true,
          company: true,
          requirement: true,
        },
      },
    },
  });
  if (!link || link.revokedAt) {
    return null;
  }
  if (link.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  if (!link.session.scorecard) {
    return null;
  }
  if (link.session.companyId !== link.companyId) {
    return null;
  }
  return link as ActiveScorecardShareLink;
}
