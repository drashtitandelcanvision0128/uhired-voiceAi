CREATE TYPE "ContentPageType" AS ENUM ('BLOG', 'JOB');

CREATE TABLE IF NOT EXISTS "ContentPage" (
    "id" TEXT NOT NULL,
    "type" "ContentPageType" NOT NULL,
    "slug" TEXT,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "location" TEXT,
    "employmentType" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContentPage_slug_key" ON "ContentPage"("slug");
CREATE INDEX IF NOT EXISTS "ContentPage_type_isPublished_idx" ON "ContentPage"("type", "isPublished");
