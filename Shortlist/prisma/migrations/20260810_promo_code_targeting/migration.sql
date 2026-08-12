-- AlterTable
ALTER TABLE "PromoCode" ADD COLUMN "recipientEmail" TEXT;
ALTER TABLE "PromoCode" ADD COLUMN "companyName" TEXT;
ALTER TABLE "PromoCode" ADD COLUMN "emailSentAt" TIMESTAMP(3);
