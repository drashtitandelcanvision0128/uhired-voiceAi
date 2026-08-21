import "server-only";
import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { sendInterviewInviteEmail, type InterviewInviteEmailInput } from "@/lib/email";

const RETRY_BASE_MS = 2 * 60 * 1000;

type EmailOutboxRow = {
  id: string;
  purpose: string;
  toEmail: string;
  payload: unknown;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  nextAttemptAt: Date;
};

export async function enqueueInterviewInviteEmail(
  prisma: PrismaClient,
  input: InterviewInviteEmailInput,
  lastError?: string,
) {
  const id = randomUUID();
  const now = new Date();
  const nextAttemptAt = new Date(Date.now() + RETRY_BASE_MS);
  const payload = {
    ...input,
    expiresAt: input.expiresAt.toISOString(),
    scheduledAt: input.scheduledAt?.toISOString() ?? null,
  };

  await prisma.$executeRaw`
    INSERT INTO "EmailOutbox"
      ("id", "purpose", "toEmail", "payload", "status", "attempts", "maxAttempts", "lastError", "nextAttemptAt", "createdAt", "updatedAt")
    VALUES (
      ${id},
      ${"interview_invite"},
      ${input.to.toLowerCase()},
      ${JSON.stringify(payload)}::jsonb,
      ${"PENDING"},
      ${0},
      ${5},
      ${lastError ?? null},
      ${nextAttemptAt},
      ${now},
      ${now}
    )
  `;

  return { id };
}

function payloadToInviteInput(payload: unknown): InterviewInviteEmailInput | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  if (
    typeof row.to !== "string" ||
    typeof row.companyName !== "string" ||
    typeof row.roleTitle !== "string" ||
    typeof row.accessCode !== "string" ||
    typeof row.interviewUrl !== "string" ||
    typeof row.expiresAt !== "string"
  ) {
    return null;
  }
  return {
    to: row.to,
    companyName: row.companyName,
    roleTitle: row.roleTitle,
    accessCode: row.accessCode,
    interviewUrl: row.interviewUrl,
    expiresAt: new Date(row.expiresAt),
    scheduledAt: typeof row.scheduledAt === "string" ? new Date(row.scheduledAt) : undefined,
    candidateName: typeof row.candidateName === "string" ? row.candidateName : undefined,
  };
}

export async function processEmailOutbox(
  prisma: PrismaClient,
  options: { limit?: number } = {},
): Promise<{ processed: number; sent: number; failed: number }> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const now = new Date();

  const pending = await prisma.$queryRaw<EmailOutboxRow[]>`
    SELECT "id", "purpose", "toEmail", "payload", "status", "attempts", "maxAttempts", "lastError", "nextAttemptAt"
    FROM "EmailOutbox"
    WHERE "status" = 'PENDING' AND "nextAttemptAt" <= ${now}
    ORDER BY "nextAttemptAt" ASC
    LIMIT ${limit}
  `;

  let sent = 0;
  let failed = 0;

  for (const row of pending) {
    if (row.purpose !== "interview_invite") {
      await prisma.$executeRaw`
        UPDATE "EmailOutbox"
        SET "status" = 'FAILED',
            "lastError" = ${`Unsupported purpose: ${row.purpose}`},
            "attempts" = ${row.attempts + 1},
            "updatedAt" = ${new Date()}
        WHERE "id" = ${row.id}
      `;
      failed += 1;
      continue;
    }

    const input = payloadToInviteInput(row.payload);
    if (!input) {
      await prisma.$executeRaw`
        UPDATE "EmailOutbox"
        SET "status" = 'FAILED',
            "lastError" = ${"Invalid invite payload."},
            "attempts" = ${row.attempts + 1},
            "updatedAt" = ${new Date()}
        WHERE "id" = ${row.id}
      `;
      failed += 1;
      continue;
    }

    try {
      await sendInterviewInviteEmail(input);
      const sentAt = new Date();
      await prisma.$executeRaw`
        UPDATE "EmailOutbox"
        SET "status" = 'SENT',
            "sentAt" = ${sentAt},
            "attempts" = ${row.attempts + 1},
            "lastError" = NULL,
            "updatedAt" = ${sentAt}
        WHERE "id" = ${row.id}
      `;
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Send failed.";
      const attempts = row.attempts + 1;
      const exhausted = attempts >= row.maxAttempts;
      const nextAttemptAt = new Date(Date.now() + RETRY_BASE_MS * Math.max(1, attempts));
      await prisma.$executeRaw`
        UPDATE "EmailOutbox"
        SET "status" = ${exhausted ? "FAILED" : "PENDING"},
            "attempts" = ${attempts},
            "lastError" = ${message},
            "nextAttemptAt" = ${nextAttemptAt},
            "updatedAt" = ${new Date()}
        WHERE "id" = ${row.id}
      `;
      if (exhausted) failed += 1;
    }
  }

  return { processed: pending.length, sent, failed };
}
