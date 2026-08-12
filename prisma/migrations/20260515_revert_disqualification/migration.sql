-- Revert company disqualification: normalize rows, drop column, restore SessionStatus enum (3 values).

UPDATE "InterviewSession"
SET "status" = 'COMPLETED'::"SessionStatus"
WHERE "status"::text = 'DISQUALIFIED';

ALTER TABLE "InterviewSession" DROP COLUMN IF EXISTS "disqualificationReason";

ALTER TYPE "SessionStatus" RENAME TO "SessionStatus_old";

CREATE TYPE "SessionStatus" AS ENUM ('READY', 'LIVE', 'COMPLETED');

ALTER TABLE "InterviewSession" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "InterviewSession"
  ALTER COLUMN "status" TYPE "SessionStatus"
  USING (
    CASE "status"::text
      WHEN 'READY' THEN 'READY'::"SessionStatus"
      WHEN 'LIVE' THEN 'LIVE'::"SessionStatus"
      WHEN 'COMPLETED' THEN 'COMPLETED'::"SessionStatus"
      ELSE 'COMPLETED'::"SessionStatus"
    END
  );

ALTER TABLE "InterviewSession" ALTER COLUMN "status" SET DEFAULT 'READY'::"SessionStatus";

DROP TYPE "SessionStatus_old";
