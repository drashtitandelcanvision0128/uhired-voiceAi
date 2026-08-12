-- CreateTable
CREATE TABLE "RequirementInvite" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessCode" TEXT NOT NULL,
    "emailSentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RequirementInvite_accessCode_key" ON "RequirementInvite"("accessCode");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementInvite_requirementId_email_key" ON "RequirementInvite"("requirementId", "email");

-- CreateIndex
CREATE INDEX "RequirementInvite_companyId_idx" ON "RequirementInvite"("companyId");

-- AddForeignKey
ALTER TABLE "RequirementInvite" ADD CONSTRAINT "RequirementInvite_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementInvite" ADD CONSTRAINT "RequirementInvite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
