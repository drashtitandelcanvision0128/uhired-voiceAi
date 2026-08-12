import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Context) {
  const { slug } = await context.params;
  const post = await prisma.contentPage.findFirst({
    where: { type: "BLOG", slug, isPublished: true },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      body: true,
      coverImageUrl: true,
      seoTitle: true,
      seoDescription: true,
      publishedAt: true,
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  return NextResponse.json({ post });
}
