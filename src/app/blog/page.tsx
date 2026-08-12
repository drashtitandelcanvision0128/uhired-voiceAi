import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { MarketingBackground } from "@/components/marketing/site/marketing-page-shell";
import { prisma } from "@/lib/prisma";
import { resolvePublicAssetUrl } from "@/lib/public-asset-url";

export const metadata: Metadata = {
  title: "Blog",
  description: "Interview tips, hiring insights, and product updates from Uhired.",
};

export const dynamic = "force-dynamic";

export default async function BlogPage() {
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

  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground">
      <MarketingBackground />
      <SiteHeader />
      <main className="flex-1 container max-w-3xl mx-auto px-4 py-16 md:px-8">
        <h1 className="text-4xl font-extrabold tracking-tight mb-4 text-foreground">Blog</h1>
        <p className="text-muted-foreground mb-10">
          Interview tips, hiring insights, and product updates from Uhired.
        </p>

        {posts.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground text-sm">
              No published posts yet. Check back soon for interview tips and hiring insights.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => {
              const coverSrc = resolvePublicAssetUrl(post.coverImageUrl);
              return (
              <article
                key={post.slug}
                className="rounded-xl border border-border p-6 bg-card overflow-hidden"
              >
                {coverSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverSrc}
                    alt=""
                    className="mb-4 w-full max-h-56 rounded-lg object-cover border border-border"
                  />
                ) : null}
                {post.publishedAt ? (
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
                    {post.publishedAt.toLocaleDateString()}
                  </p>
                ) : null}
                <h2 className="text-xl font-bold mb-2 text-foreground">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="no-underline hover:text-primary transition-colors"
                  >
                    {post.title}
                  </Link>
                </h2>
                {post.excerpt ? (
                  <p className="text-muted-foreground text-sm mb-4">{post.excerpt}</p>
                ) : null}
                <Link
                  href={`/blog/${post.slug}`}
                  className="text-sm font-semibold text-primary no-underline hover:underline"
                >
                  Read more →
                </Link>
              </article>
            );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
