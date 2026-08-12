-- AlterTable
ALTER TABLE "RequirementQuestion" ADD COLUMN "expectedAnswer" TEXT,
ADD COLUMN "gradingRubric" TEXT,
ADD COLUMN "difficulty" TEXT NOT NULL DEFAULT 'medium';

-- AlterTable
ALTER TABLE "InterviewQuestion" ADD COLUMN "expectedAnswer" TEXT,
ADD COLUMN "gradingRubric" TEXT,
ADD COLUMN "difficulty" TEXT NOT NULL DEFAULT 'medium';

-- AlterTable
ALTER TABLE "InterviewSession" ADD COLUMN "pickedOptionalQuestionIds" JSONB;

-- AlterTable
ALTER TABLE "Scorecard" ADD COLUMN "accuracyPercent" INTEGER,
ADD COLUMN "questionResults" JSONB;
