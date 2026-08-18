-- AlterTable
ALTER TABLE "RequirementInvite" ADD COLUMN "candidateName" TEXT;
ALTER TABLE "RequirementInvite" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'email';
ALTER TABLE "RequirementInvite" ADD COLUMN "scheduledAt" TIMESTAMP(3);
