import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { MarketingBackground } from "@/components/marketing/site/marketing-page-shell";
import { MarkdownContent } from "@/components/markdown-content";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { resolvePublicAssetUrl } from "@/lib/public-asset-url";

type PageProps = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

function absoluteAssetUrl(url: string | null | undefined) {
  const resolved = resolvePublicAssetUrl(url);
  if (!resolved) return undefined;
  if (resolved.startsWith("http://") || resolved.startsWith("https://")) return resolved;
  const base = env.publicAppUrl.replace(/\/$/, "");
  return `${base}${resolved}`;
}

async function getPost(slug: string) {
  return prisma.contentPage.findFirst({
    where: { type: "BLOG", slug, isPublished: true },
    select: {
      title: true,
      excerpt: true,
      body: true,
      coverImageUrl: true,
      seoTitle: true,
      seoDescription: true,
      publishedAt: true,
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) {
    return { title: "Blog" };
  }
  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt || undefined,
    openGraph: post.coverImageUrl
      ? { images: [{ url: absoluteAssetUrl(post.coverImageUrl)!, alt: post.title }] }
      : undefined,
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) {
    notFound();
  }

  const coverSrc = resolvePublicAssetUrl(post.coverImageUrl);

  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground">
      <MarketingBackground />
      <SiteHeader />
      <main className="flex-1 container max-w-3xl mx-auto px-4 py-16 md:px-8">
        <Link
          href="/blog"
          className="text-sm font-semibold text-primary no-underline mb-6 inline-block"
        >
          ← Back to blog
        </Link>
        <article>
          {post.publishedAt ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-3">
              {post.publishedAt.toLocaleDateString()}
            </p>
          ) : null}
          <h1 className="text-3xl font-extrabold tracking-tight mb-4 text-foreground">
            {post.title}
          </h1>
          {post.excerpt ? (
            <p className="text-lg text-muted-foreground mb-8">{post.excerpt}</p>
          ) : null}
          {coverSrc ? (
            <img
              src={coverSrc}
              alt=""
              className="mb-8 w-full rounded-2xl border border-border object-cover max-h-[420px]"
            />
          ) : null}
          <MarkdownContent source={post.body} />
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
