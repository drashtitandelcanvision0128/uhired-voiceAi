import "server-only";
import type { Prisma } from "@prisma/client";

type CandidateSessionSyncInput = {
  companyId: string;
  candidateId: string;
  previousEmail: string | null;
  nextEmail?: string;
  candidateName?: string;
  candidateEmail?: string;
};

export function buildLinkedSessionWhere({
  companyId,
  candidateId,
  previousEmail,
  nextEmail,
}: Pick<CandidateSessionSyncInput, "companyId" | "candidateId" | "previousEmail" | "nextEmail">): Prisma.InterviewSessionWhereInput {
  const emails = new Set<string>();
  if (previousEmail) emails.add(previousEmail.toLowerCase());
  if (nextEmail) emails.add(nextEmail.toLowerCase());

  const orFilters: Prisma.InterviewSessionWhereInput[] = [{ candidateId }];
  if (emails.size > 0) {
    orFilters.push({ candidateEmail: { in: [...emails] } });
  }

  return {
    companyId,
    sessionType: "COMPANY",
    OR: orFilters,
  };
}

export async function syncInterviewSessionsForCandidate(
  tx: Prisma.TransactionClient,
  input: CandidateSessionSyncInput,
): Promise<number> {
  const sessionSync: { candidateName?: string; candidateEmail?: string } = {};
  if (input.candidateName !== undefined) sessionSync.candidateName = input.candidateName;
  if (input.candidateEmail !== undefined) sessionSync.candidateEmail = input.candidateEmail.toLowerCase();
  if (Object.keys(sessionSync).length === 0) return 0;

  const result = await tx.interviewSession.updateMany({
    where: buildLinkedSessionWhere(input),
    data: sessionSync,
  });
  return result.count;
}

export async function syncCandidateFromSession(
  tx: Prisma.TransactionClient,
  candidateId: string | null | undefined,
  data: { candidateName?: string; candidateEmail?: string; companyId?: string },
): Promise<void> {
  if (!candidateId) return;
  const candidateUpdate: { name?: string; email?: string } = {};
  if (data.candidateName !== undefined) candidateUpdate.name = data.candidateName;
  if (data.candidateEmail !== undefined) candidateUpdate.email = data.candidateEmail.toLowerCase();
  if (Object.keys(candidateUpdate).length === 0) return;
  if (data.companyId) {
    await tx.candidate.updateMany({
      where: { id: candidateId, companyId: data.companyId },
      data: candidateUpdate,
    });
    return;
  }
  await tx.candidate.update({ where: { id: candidateId }, data: candidateUpdate });
}
