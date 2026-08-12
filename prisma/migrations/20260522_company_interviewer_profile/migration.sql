-- CreateEnum
CREATE TYPE "InterviewerVoiceGender" AS ENUM ('MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "interviewerName" TEXT,
ADD COLUMN "interviewerVoiceGender" "InterviewerVoiceGender" NOT NULL DEFAULT 'MALE';
