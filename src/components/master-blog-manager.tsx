"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, ImageIcon, Search } from "lucide-react";
import { useConfirm, useToast } from "@/components/app-feedback";
import {
  MasterAlert,
  MasterRowActionsMenu,
  MasterSelect,
  masterBtnGhost,
  masterBtnPrimary,
  masterInputClass,
} from "@/components/master-ui";
import { normalizeCoverImageUrl, resolvePublicAssetUrl } from "@/lib/public-asset-url";

type BlogPost = {
  id: string;
  slug: string | null;
  title: string;
  excerpt: string | null;
  body: string;
  coverImageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  isPublished: boolean;
  publishedAt: string | null;
};

type BlogFormState = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageUrl: string;
  seoTitle: string;
  seoDescription: string;
  isPublished: boolean;
};

const emptyForm: BlogFormState = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  coverImageUrl: "",
  seoTitle: "",
  seoDescription: "",
  isPublished: true,
};

function isPreviewableImageUrl(url: string) {
  return Boolean(resolvePublicAssetUrl(url));
}

export function MasterBlogManager() {
  const confirm = useConfirm();
  const toast = useToast();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [postSearch, setPostSearch] = useState("");
  const [publishFilter, setPublishFilter] = useState<"ALL" | "published" | "draft">("ALL");

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/master/content-pages?type=BLOG", { cache: "no-store" });
      const data = (await res.json()) as { pages?: BlogPost[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not load posts.");
        return;
      }
      setPosts(data.pages ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredPosts = useMemo(() => {
    const query = postSearch.trim().toLowerCase();
    return posts.filter((post) => {
      if (publishFilter === "published" && !post.isPublished) return false;
      if (publishFilter === "draft" && post.isPublished) return false;
      if (!query) return true;
      return `${post.title} ${post.slug ?? ""} ${post.excerpt ?? ""}`.toLowerCase().includes(query);
    });
  }, [posts, postSearch, publishFilter]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  function startEdit(post: BlogPost) {
    setEditingId(post.id);
    setForm({
      title: post.title,
      slug: post.slug ?? "",
      excerpt: post.excerpt ?? "",
      body: post.body,
      coverImageUrl: post.coverImageUrl ?? "",
      seoTitle: post.seoTitle ?? "",
      seoDescription: post.seoDescription ?? "",
      isPublished: post.isPublished,
    });
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function createPost() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/master/content-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "BLOG",
          title: form.title,
          slug: form.slug,
          excerpt: form.excerpt,
          body: form.body,
          coverImageUrl: normalizeCoverImageUrl(form.coverImageUrl),
          seoTitle: form.seoTitle,
          seoDescription: form.seoDescription,
          isPublished: form.isPublished,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not create post.");
        return;
      }
      toast.success(form.isPublished ? "Published." : "Draft saved.");
      setForm(emptyForm);
      await loadPosts();
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(postId: string) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/master/content-pages/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          slug: form.slug,
          excerpt: form.excerpt,
          body: form.body,
          coverImageUrl: normalizeCoverImageUrl(form.coverImageUrl),
          seoTitle: form.seoTitle,
          seoDescription: form.seoDescription,
          isPublished: form.isPublished,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save.");
        return;
      }
      toast.success("Saved.");
      cancelEdit();
      await loadPosts();
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(post: BlogPost) {
    const nextPublished = !post.isPublished;
    const res = await fetch(`/api/master/content-pages/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: nextPublished }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not update.");
      return;
    }
    if (editingId === post.id) {
      setForm((prev) => ({ ...prev, isPublished: nextPublished }));
    }
    toast.success(post.isPublished ? "Unpublished." : "Published.");
    await loadPosts();
  }

  async function deletePost(id: string) {
    const ok = await confirm({
      title: "Delete this post?",
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/master/content-pages/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Could not delete.");
      return;
    }
    if (editingId === id) cancelEdit();
    toast.success("Deleted.");
    await loadPosts();
  }

  return (
    <div className="space-y-4">
      {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}

      <section className="admin-card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{editingId ? "Edit post" : "New post"}</p>
            <p className="text-xs text-muted-foreground">Published posts show on /blog.</p>
          </div>
          <Link
            href="/blog"
            target="_blank"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View blog
          </Link>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1">
              <span className="admin-label">Title</span>
              <input
                className={masterInputClass}
                placeholder="Post title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <label className="block space-y-1">
              <span className="admin-label">Slug</span>
              <input
                className={masterInputClass}
                placeholder="auto from title"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="admin-label">Excerpt</span>
            <input
              className={masterInputClass}
              placeholder="Short line for the listing"
              value={form.excerpt}
              onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
            />
          </label>

          <label className="relative z-0 block space-y-1">
            <span className="admin-label">Body</span>
            <textarea
              className={`${masterInputClass} relative z-0 min-h-[160px] resize-y text-sm`}
              placeholder="Write the post. Markdown is ok."
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
          </label>

          <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,16rem)]">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">SEO</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="admin-label">SEO title</span>
                  <input
                    className={masterInputClass}
                    placeholder="Optional"
                    value={form.seoTitle}
                    onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="admin-label">SEO description</span>
                  <input
                    className={masterInputClass}
                    placeholder="Optional"
                    value={form.seoDescription}
                    onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))}
                  />
                </label>
              </div>
            </div>
            <CoverImageField
              value={form.coverImageUrl}
              onChange={(coverImageUrl) => setForm((f) => ({ ...f, coverImageUrl }))}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
              />
              Publish
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {editingId ? (
                <button type="button" className={masterBtnGhost} onClick={cancelEdit}>
                  Cancel
                </button>
              ) : null}
              <button
                type="button"
                disabled={saving || !form.title.trim() || !form.body.trim()}
                className={`${masterBtnPrimary} disabled:opacity-50`}
                onClick={() => (editingId ? void saveEdit(editingId) : void createPost())}
              >
                {saving ? "Saving…" : editingId ? "Save" : form.isPublished ? "Publish" : "Save draft"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-card overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Posts</p>
            <p className="text-xs text-muted-foreground">{filteredPosts.length} shown</p>
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:min-w-[18rem]">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={postSearch}
                onChange={(event) => setPostSearch(event.target.value)}
                placeholder="Title or slug"
                className={`${masterInputClass} w-full pl-10`}
                aria-label="Search posts"
              />
            </div>
            <MasterSelect
              value={publishFilter}
              onValueChange={(value) => setPublishFilter(value as typeof publishFilter)}
              className="min-w-[9rem]"
              aria-label="Filter by status"
              options={[
                { value: "ALL", label: "All" },
                { value: "published", label: "Published" },
                { value: "draft", label: "Drafts" },
              ]}
            />
          </div>
        </div>

        {loading && !posts.length ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No posts yet.</p>
        ) : filteredPosts.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No matching posts.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filteredPosts.map((post) => (
              <li
                key={post.id}
                className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/40 ${
                  editingId === post.id ? "bg-primary/5" : ""
                }`}
              >
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted ring-1 ring-border">
                  {isPreviewableImageUrl(post.coverImageUrl ?? "") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolvePublicAssetUrl(post.coverImageUrl ?? "") ?? ""}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-foreground">{post.title}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        post.isPublished
                          ? "bg-success/12 text-success ring-1 ring-success/25"
                          : "bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/25 dark:text-amber-200"
                      }`}
                    >
                      {post.isPublished ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {post.slug ? `/blog/${post.slug}` : "No slug"}
                    {post.publishedAt ? ` · ${new Date(post.publishedAt).toLocaleDateString()}` : ""}
                  </p>
                  {post.excerpt ? (
                    <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{post.excerpt}</p>
                  ) : null}
                </div>
                <MasterRowActionsMenu
                  label={post.title}
                  actions={[
                    post.isPublished && post.slug
                      ? {
                          label: "View",
                          onClick: () => window.open(`/blog/${post.slug}`, "_blank"),
                        }
                      : null,
                    { label: "Edit", onClick: () => startEdit(post) },
                    {
                      label: post.isPublished ? "Unpublish" : "Publish",
                      onClick: () => void togglePublish(post),
                    },
                    {
                      label: "Delete",
                      onClick: () => void deletePost(post.id),
                      danger: true,
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CoverImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/master/content-pages/upload-image", {
        method: "POST",
        body,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Could not upload.");
      }
      onChange(data.url);
    } catch (uploadErr) {
      setUploadError(uploadErr instanceof Error ? uploadErr.message : "Could not upload.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cover</p>
      {isPreviewableImageUrl(value) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvePublicAssetUrl(value) ?? ""}
          alt=""
          className="h-24 w-full rounded-lg object-cover ring-1 ring-border"
        />
      ) : (
        <div className="flex h-24 items-center justify-center rounded-lg bg-muted ring-1 ring-border">
          <ImageIcon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="flex gap-2">
        <input
          className={`${masterInputClass} min-w-0 flex-1`}
          placeholder="Image URL"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <label
          className={`${masterBtnGhost} shrink-0 cursor-pointer !px-3 ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          {uploading ? "…" : "Upload"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
    </div>
  );
}
