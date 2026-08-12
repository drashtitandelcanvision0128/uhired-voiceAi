import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const posts = await prisma.contentPage.findMany({
    where: { type: "BLOG", isPublished: true, slug: { not: null } },
    orderBy: { publishedAt: "desc" },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      coverImageUrl: true,
      publishedAt: true,
    },
  });

  return NextResponse.json({ posts });
}
