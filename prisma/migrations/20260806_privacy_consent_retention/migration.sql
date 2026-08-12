-- Interview consent + anonymization markers
ALTER TABLE "InterviewSession" ADD COLUMN IF NOT EXISTS "consentAcceptedAt" TIMESTAMP(3);
ALTER TABLE "InterviewSession" ADD COLUMN IF NOT EXISTS "consentVersion" TEXT;
ALTER TABLE "InterviewSession" ADD COLUMN IF NOT EXISTS "dataAnonymizedAt" TIMESTAMP(3);

-- Candidate data deletion requests (DPDP / privacy rights)
CREATE TYPE "DataDeletionRequestStatus" AS ENUM ('PENDING', 'PROCESSED', 'REJECTED');

CREATE TABLE IF NOT EXISTS "DataDeletionRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "status" "DataDeletionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "clientIp" TEXT,
    "processedAt" TIMESTAMP(3),
    "resultNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataDeletionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DataDeletionRequest_email_idx" ON "DataDeletionRequest"("email");
CREATE INDEX IF NOT EXISTS "DataDeletionRequest_status_createdAt_idx" ON "DataDeletionRequest"("status", "createdAt");
