-- AlterTable
ALTER TABLE "InterviewTurn" ADD COLUMN "orderIndex" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing rows per session by creation time
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "sessionId" ORDER BY "createdAt" ASC, id ASC) - 1 AS idx
  FROM "InterviewTurn"
)
UPDATE "InterviewTurn" AS t
SET "orderIndex" = ranked.idx
FROM ranked
WHERE t.id = ranked.id;
