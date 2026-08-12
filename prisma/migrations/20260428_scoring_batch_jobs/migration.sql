-- CreateEnum
CREATE TYPE "ScoringJobStatus" AS ENUM ('PENDING', 'SUBMITTED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ScoringBatchJob" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "ScoringJobStatus" NOT NULL DEFAULT 'PENDING',
    "batchId" TEXT,
    "inputPayload" JSONB NOT NULL,
    "resultPayload" JSONB,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringBatchJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScoringBatchJob_status_createdAt_idx" ON "ScoringBatchJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ScoringBatchJob_sessionId_createdAt_idx" ON "ScoringBatchJob"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ScoringBatchJob_batchId_status_idx" ON "ScoringBatchJob"("batchId", "status");

-- AddForeignKey
ALTER TABLE "ScoringBatchJob" ADD CONSTRAINT "ScoringBatchJob_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
