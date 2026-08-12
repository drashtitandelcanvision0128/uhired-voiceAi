import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { deleteInterviewVideoAssets } from "@/lib/interview-video-storage";

export type RetentionRunResult = {
  videoSessionsProcessed: number;
  transcriptSessionsProcessed: number;
  practiceSessionsAnonymized: number;
};

function daysToMs(days: number) {
  return days * 24 * 60 * 60 * 1000;
}

import { env } from "@/lib/env";

export function getVideoRetentionDays() {
  return env.dataRetentionDaysVideo;
}

export function getTranscriptRetentionDays() {
  return env.dataRetentionDaysTranscript;
}

export function getPracticeRetentionDays() {
  return env.dataRetentionDaysPractice;
}

/**
 * Deletes expired interview videos and old practice transcripts per retention policy.
 * Company transcripts are kept until transcript retention unless already anonymized.
 */
export async function runDataRetentionCleanup(prisma: PrismaClient): Promise<RetentionRunResult> {
  const now = Date.now();
  const videoCutoff = new Date(now - daysToMs(getVideoRetentionDays()));
  const transcriptCutoff = new Date(now - daysToMs(getTranscriptRetentionDays()));
  const practiceCutoff = new Date(now - daysToMs(getPracticeRetentionDays()));

  let videoSessionsProcessed = 0;
  let transcriptSessionsProcessed = 0;
  let practiceSessionsAnonymized = 0;

  const videoCandidates = await prisma.interviewSession.findMany({
    where: {
      sessionType: "COMPANY",
      endedAt: { not: null, lt: videoCutoff },
      dataAnonymizedAt: null,
    },
    select: { id: true },
    take: 200,
  });

  for (const session of videoCandidates) {
    try {
      await deleteInterviewVideoAssets(session.id);
      videoSessionsProcessed += 1;
    } catch {
      // ignore per-session failures
    }
  }

  const transcriptCandidates = await prisma.interviewSession.findMany({
    where: {
      endedAt: { not: null, lt: transcriptCutoff },
      dataAnonymizedAt: null,
    },
    select: { id: true, sessionType: true },
    take: 200,
  });

  for (const session of transcriptCandidates) {
    await prisma.interviewTurn.deleteMany({ where: { sessionId: session.id } });
    transcriptSessionsProcessed += 1;
  }

  const practiceCandidates = await prisma.interviewSession.findMany({
    where: {
      sessionType: "PRACTICE",
      endedAt: { not: null, lt: practiceCutoff },
      dataAnonymizedAt: null,
    },
    select: { id: true, candidateEmail: true },
    take: 200,
  });

  for (const session of practiceCandidates) {
    await prisma.interviewTurn.deleteMany({ where: { sessionId: session.id } });
    try {
      await deleteInterviewVideoAssets(session.id);
    } catch {
      // ignore
    }
    await prisma.interviewSession.update({
      where: { id: session.id },
      data: {
        candidateName: "Retention Purged",
        candidateEmail: null,
        jobDescription: null,
        keySkills: Prisma.JsonNull,
        dataAnonymizedAt: new Date(),
      },
    });
    practiceSessionsAnonymized += 1;
  }

  if (videoSessionsProcessed + transcriptSessionsProcessed > 0) {
    console.log(
      `[data-retention] video=${videoSessionsProcessed} transcript=${transcriptSessionsProcessed} practice=${practiceSessionsAnonymized}`,
    );
  }

  return {
    videoSessionsProcessed,
    transcriptSessionsProcessed,
    practiceSessionsAnonymized,
  };
}
