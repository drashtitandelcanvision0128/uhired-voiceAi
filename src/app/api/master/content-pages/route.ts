import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { normalizeCoverImageUrl } from "@/lib/public-asset-url";

const optionalHttpUrl = z.preprocess(
  (value) => (typeof value === "string" ? normalizeCoverImageUrl(value) : value),
  z.union([
    z.literal(""),
    z.string().startsWith("/"),
    z.string().url({ message: "Cover image must be a valid URL." }),
  ]),
);

const createSchema = z.object({
  type: z.enum(["BLOG", "JOB"]),
  slug: z.string().trim().max(120).optional(),
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().max(500).optional(),
  body: z.string().trim().min(1),
  coverImageUrl: optionalHttpUrl.optional(),
  seoTitle: z.string().trim().max(120).optional(),
  seoDescription: z.string().trim().max(300).optional(),
  location: z.string().trim().max(120).optional(),
  employmentType: z.string().trim().max(80).optional(),
  isPublished: z.boolean().optional(),
});

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const type = new URL(request.url).searchParams.get("type");
  const where =
    type === "BLOG" || type === "JOB" ? { type: type as "BLOG" | "JOB" } : {};

  const pages = await prisma.contentPage.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ pages });
}

export async function POST(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = createSchema.parse(await request.json());
    const slug =
      body.type === "BLOG"
        ? (body.slug?.trim() || slugify(body.title)) || `post-${Date.now()}`
        : null;

    if (slug) {
      const clash = await prisma.contentPage.findUnique({ where: { slug }, select: { id: true } });
      if (clash) {
        return NextResponse.json({ error: "That blog slug is already in use." }, { status: 409 });
      }
    }

    const isPublished = body.isPublished ?? false;
    const page = await prisma.contentPage.create({
      data: {
        type: body.type,
        slug,
        title: body.title,
        excerpt: body.excerpt?.trim() || null,
        body: body.body,
        coverImageUrl: body.coverImageUrl?.trim() || null,
        seoTitle: body.seoTitle?.trim() || null,
        seoDescription: body.seoDescription?.trim() || null,
        location: body.type === "JOB" ? body.location?.trim() || null : null,
        employmentType: body.type === "JOB" ? body.employmentType?.trim() || null : null,
        isPublished,
        publishedAt: isPublished ? new Date() : null,
      },
    });

    if (body.type === "BLOG" && isPublished) {
      revalidatePath("/blog");
      if (slug) {
        revalidatePath(`/blog/${slug}`);
      }
    } else if (body.type === "JOB" && isPublished) {
      revalidatePath("/careers");
    }

    return NextResponse.json({ ok: true, page });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create content." }, { status: 500 });
  }
}
