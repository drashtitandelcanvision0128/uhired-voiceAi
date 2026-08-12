-- CreateEnum
CREATE TYPE "CompanyMemberRole" AS ENUM ('ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'VIEWER');

-- CreateTable
CREATE TABLE "CompanyMember" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "CompanyMemberRole" NOT NULL DEFAULT 'RECRUITER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ssoSubject" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyMember_email_idx" ON "CompanyMember"("email");

-- CreateIndex
CREATE INDEX "CompanyMember_companyId_role_idx" ON "CompanyMember"("companyId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMember_companyId_email_key" ON "CompanyMember"("companyId", "email");

-- AddForeignKey
ALTER TABLE "CompanyMember" ADD CONSTRAINT "CompanyMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
