-- AlterEnum
ALTER TYPE "SessionStatus" ADD VALUE 'DISQUALIFIED';

-- AlterTable
ALTER TABLE "InterviewSession" ADD COLUMN "disqualificationReason" TEXT;
