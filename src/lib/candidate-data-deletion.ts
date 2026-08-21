import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { deleteInterviewVideoAssets } from "@/lib/interview-video-storage";

const ANONYMIZED_LABEL = "Deleted User";

export type DeletePracticeDataResult = {
  sessionsProcessed: number;
  videosDeleted: number;
  turnsDeleted: number;
};

/**
 * Anonymize and purge PII for practice sessions owned by an email address.
 */
export async function deletePracticeDataForEmail(
  prisma: PrismaClient,
  email: string,
): Promise<DeletePracticeDataResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return { sessionsProcessed: 0, videosDeleted: 0, turnsDeleted: 0 };
  }

  const sessions = await prisma.interviewSession.findMany({
    where: {
      sessionType: "PRACTICE",
      candidateEmail: normalized,
      dataAnonymizedAt: null,
    },
    select: { id: true },
  });

  let videosDeleted = 0;
  let turnsDeleted = 0;

  for (const session of sessions) {
    const turnDelete = await prisma.interviewTurn.deleteMany({ where: { sessionId: session.id } });
    turnsDeleted += turnDelete.count;

    try {
      await deleteInterviewVideoAssets(session.id);
      videosDeleted += 1;
    } catch {
      // Video may not exist
    }

    await prisma.scorecardShareLink.deleteMany({ where: { sessionId: session.id } });

    if (await prisma.scorecard.findUnique({ where: { sessionId: session.id } })) {
      await prisma.scorecard.update({
        where: { sessionId: session.id },
        data: {
          summary: "Scorecard removed per data deletion request.",
          strengths: [],
          improvements: [],
          evidence: [],
          questionResults: [],
        },
      });
    }

    await prisma.interviewSession.update({
      where: { id: session.id },
      data: {
        candidateName: ANONYMIZED_LABEL,
        candidateEmail: null,
        jobDescription: null,
        keySkills: Prisma.JsonNull,
        dataAnonymizedAt: new Date(),
      },
    });
  }

  return {
    sessionsProcessed: sessions.length,
    videosDeleted,
    turnsDeleted,
  };
}

/**
 * Anonymize company-hiring sessions for an email (master-approved deletion).
 */
export async function anonymizeCompanySessionsForEmail(
  prisma: PrismaClient,
  email: string,
): Promise<DeletePracticeDataResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return { sessionsProcessed: 0, videosDeleted: 0, turnsDeleted: 0 };
  }

  const sessions = await prisma.interviewSession.findMany({
    where: {
      sessionType: "COMPANY",
      candidateEmail: normalized,
      dataAnonymizedAt: null,
    },
    select: { id: true },
  });

  let videosDeleted = 0;
  let turnsDeleted = 0;

  for (const session of sessions) {
    const turnDelete = await prisma.interviewTurn.deleteMany({ where: { sessionId: session.id } });
    turnsDeleted += turnDelete.count;

    try {
      await deleteInterviewVideoAssets(session.id);
      videosDeleted += 1;
    } catch {
      // ignore
    }

    await prisma.scorecardShareLink.deleteMany({ where: { sessionId: session.id } });
    await prisma.interviewObserverLink.deleteMany({ where: { sessionId: session.id } }).catch(() => null);

    if (await prisma.scorecard.findUnique({ where: { sessionId: session.id } })) {
      await prisma.scorecard.update({
        where: { sessionId: session.id },
        data: {
          summary: "Scorecard removed per data deletion request.",
          strengths: [],
          improvements: [],
          evidence: [],
          questionResults: [],
        },
      });
    }

    await prisma.interviewSession.update({
      where: { id: session.id },
      data: {
        candidateName: ANONYMIZED_LABEL,
        candidateEmail: null,
        jobDescription: null,
        keySkills: Prisma.JsonNull,
        dataAnonymizedAt: new Date(),
      },
    });
  }

  await prisma.candidate.updateMany({
    where: { email: normalized, isArchived: false },
    data: { name: ANONYMIZED_LABEL, email: null, isArchived: true },
  });

  return {
    sessionsProcessed: sessions.length,
    videosDeleted,
    turnsDeleted,
  };
}
