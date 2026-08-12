-- CreateTable
CREATE TABLE "SupportInquiry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'PUBLIC_CONTACT',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "clientIp" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportInquiry_createdAt_idx" ON "SupportInquiry"("createdAt");

-- CreateIndex
CREATE INDEX "SupportInquiry_status_idx" ON "SupportInquiry"("status");

-- CreateIndex
CREATE INDEX "SupportInquiry_email_idx" ON "SupportInquiry"("email");
