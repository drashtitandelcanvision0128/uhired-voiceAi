-- CreateTable
CREATE TABLE "ScorecardShareLink" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "includeCandidateName" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScorecardShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScorecardShareLink_tokenHash_key" ON "ScorecardShareLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ScorecardShareLink_sessionId_idx" ON "ScorecardShareLink"("sessionId");

-- CreateIndex
CREATE INDEX "ScorecardShareLink_companyId_idx" ON "ScorecardShareLink"("companyId");

-- AddForeignKey
ALTER TABLE "ScorecardShareLink" ADD CONSTRAINT "ScorecardShareLink_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScorecardShareLink" ADD CONSTRAINT "ScorecardShareLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
