-- Phase 2 SRS features: branding, multi-language, ATS webhook, candidate portal, observer links

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "brandDisplayName" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "brandPrimaryColor" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "brandLogoUrl" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "interviewLanguage" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "atsWebhookUrl" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "atsWebhookSecret" TEXT;

ALTER TABLE "Requirement" ADD COLUMN IF NOT EXISTS "interviewLanguage" TEXT;

CREATE TABLE IF NOT EXISTS "CandidatePortalOtp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CandidatePortalOtp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CandidatePortalOtp_email_idx" ON "CandidatePortalOtp"("email");

CREATE TABLE IF NOT EXISTS "InterviewObserverLink" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterviewObserverLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InterviewObserverLink_tokenHash_key" ON "InterviewObserverLink"("tokenHash");
CREATE INDEX IF NOT EXISTS "InterviewObserverLink_sessionId_idx" ON "InterviewObserverLink"("sessionId");
CREATE INDEX IF NOT EXISTS "InterviewObserverLink_companyId_idx" ON "InterviewObserverLink"("companyId");

ALTER TABLE "InterviewObserverLink" DROP CONSTRAINT IF EXISTS "InterviewObserverLink_sessionId_fkey";
ALTER TABLE "InterviewObserverLink" ADD CONSTRAINT "InterviewObserverLink_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewObserverLink" DROP CONSTRAINT IF EXISTS "InterviewObserverLink_companyId_fkey";
ALTER TABLE "InterviewObserverLink" ADD CONSTRAINT "InterviewObserverLink_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
