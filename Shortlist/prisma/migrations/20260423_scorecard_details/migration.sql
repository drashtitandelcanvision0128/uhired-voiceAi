-- AlterTable
ALTER TABLE "Scorecard"
ADD COLUMN "strengths" JSONB,
ADD COLUMN "improvements" JSONB,
ADD COLUMN "evidence" JSONB,
ADD COLUMN "scoringMode" TEXT DEFAULT 'heuristic',
ADD COLUMN "scoringModel" TEXT;
