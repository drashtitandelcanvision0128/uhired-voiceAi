import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { normalizeCoverImageUrl } from "@/lib/public-asset-url";

type Context = { params: Promise<{ pageId: string }> };

const optionalHttpUrl = z.preprocess(
  (value) => (typeof value === "string" ? normalizeCoverImageUrl(value) : value),
  z.union([
    z.literal(""),
    z.string().startsWith("/"),
    z.string().url({ message: "Cover image must be a valid URL." }),
  ]),
);

const patchSchema = z.object({
  slug: z.string().trim().max(120).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  excerpt: z.string().trim().max(500).optional(),
  body: z.string().trim().min(1).optional(),
  coverImageUrl: optionalHttpUrl.optional(),
  seoTitle: z.string().trim().max(120).optional(),
  seoDescription: z.string().trim().max(300).optional(),
  location: z.string().trim().max(120).optional(),
  employmentType: z.string().trim().max(80).optional(),
  isPublished: z.boolean().optional(),
});

export async function PATCH(request: Request, context: Context) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { pageId } = await context.params;

  try {
    const body = patchSchema.parse(await request.json());
    const existing = await prisma.contentPage.findUnique({ where: { id: pageId } });
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    if (body.slug && existing.type === "BLOG") {
      const clash = await prisma.contentPage.findFirst({
        where: { slug: body.slug, NOT: { id: pageId } },
        select: { id: true },
      });
      if (clash) {
        return NextResponse.json({ error: "Slug already in use." }, { status: 409 });
      }
    }

    const isPublished = body.isPublished ?? existing.isPublished;
    const page = await prisma.contentPage.update({
      where: { id: pageId },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.excerpt !== undefined ? { excerpt: body.excerpt || null } : {}),
        ...(body.body !== undefined ? { body: body.body } : {}),
        ...(body.coverImageUrl !== undefined ? { coverImageUrl: body.coverImageUrl || null } : {}),
        ...(body.seoTitle !== undefined ? { seoTitle: body.seoTitle || null } : {}),
        ...(body.seoDescription !== undefined ? { seoDescription: body.seoDescription || null } : {}),
        ...(body.slug !== undefined && existing.type === "BLOG" ? { slug: body.slug || null } : {}),
        ...(body.location !== undefined ? { location: body.location || null } : {}),
        ...(body.employmentType !== undefined ? { employmentType: body.employmentType || null } : {}),
        ...(body.isPublished !== undefined
          ? {
              isPublished,
              publishedAt: isPublished ? existing.publishedAt ?? new Date() : null,
            }
          : {}),
      },
    });

    if (existing.type === "BLOG" && body.isPublished !== undefined) {
      revalidatePath("/blog");
      const slugToRevalidate = body.slug ?? existing.slug;
      if (slugToRevalidate) {
        revalidatePath(`/blog/${slugToRevalidate}`);
      }
    } else if (existing.type === "JOB" && body.isPublished !== undefined) {
      revalidatePath("/careers");
    }

    return NextResponse.json({ ok: true, page });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update content." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { pageId } = await context.params;
  const existing = await prisma.contentPage.findUnique({
    where: { id: pageId },
    select: { type: true, slug: true },
  });
  await prisma.contentPage.delete({ where: { id: pageId } });

  if (existing?.type === "BLOG") {
    revalidatePath("/blog");
    if (existing.slug) {
      revalidatePath(`/blog/${existing.slug}`);
    }
  } else if (existing?.type === "JOB") {
    revalidatePath("/careers");
  }

  return NextResponse.json({ ok: true });
}
