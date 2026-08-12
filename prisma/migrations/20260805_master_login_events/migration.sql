-- CreateTable
CREATE TABLE "MasterLoginEvent" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "clientIp" TEXT,
    "userAgent" TEXT,
    "trustDevice" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterLoginEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MasterLoginEvent_createdAt_idx" ON "MasterLoginEvent"("createdAt");

-- CreateIndex
CREATE INDEX "MasterLoginEvent_email_success_idx" ON "MasterLoginEvent"("email", "success");
