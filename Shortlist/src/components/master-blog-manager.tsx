"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useConfirm, useToast } from "@/components/app-feedback";
import { MasterAlert, MasterCard, masterBtnPrimary, masterInputClass } from "@/components/master-ui";
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

const emptyForm = {
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
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/master/content-pages?type=BLOG", { cache: "no-store" });
      const data = (await res.json()) as { pages?: BlogPost[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Unable to load blog posts.");
        return;
      }
      setPosts(data.pages ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  function startEdit(post: BlogPost) {
    setEditingId(post.id);
    setEditForm({
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
    setSuccess("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyForm);
  }

  async function createPost() {
    setSaving(true);
    setError("");
    setSuccess("");
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
        setError(data.error ?? "Unable to create post.");
        return;
      }
      setSuccess(
        form.isPublished
          ? "Blog post published — it will appear on /blog."
          : "Draft saved. Publish to show on the public blog.",
      );
      toast.success(
        form.isPublished ? "Blog post published successfully." : "Draft saved successfully.",
      );
      setForm(emptyForm);
      await loadPosts();
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(postId: string) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/master/content-pages/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          slug: editForm.slug,
          excerpt: editForm.excerpt,
          body: editForm.body,
          coverImageUrl: normalizeCoverImageUrl(editForm.coverImageUrl),
          seoTitle: editForm.seoTitle,
          seoDescription: editForm.seoDescription,
          isPublished: editForm.isPublished,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Unable to save.");
        return;
      }
      setSuccess("Blog post updated.");
      toast.success("Blog post updated successfully.");
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
      setError(data.error ?? "Unable to update publish status.");
      return;
    }
    if (editingId === post.id) {
      setEditForm((prev) => ({ ...prev, isPublished: nextPublished }));
    }
    const message = post.isPublished ? "Post unpublished." : "Post published on /blog.";
    setSuccess(message);
    toast.success(post.isPublished ? "Post unpublished." : "Post published successfully.");
    await loadPosts();
  }

  async function deletePost(id: string) {
    const ok = await confirm({
      title: "Delete blog post?",
      message: "This permanently removes the post from your blog. This action cannot be undone.",
      confirmLabel: "Delete post",
      variant: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/master/content-pages/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Unable to delete post.");
      return;
    }
    if (editingId === id) cancelEdit();
    setSuccess("Blog post deleted.");
    toast.success("Blog post deleted.");
    await loadPosts();
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Published posts appear on the public{" "}
          <Link href="/blog" className="font-semibold text-emerald-700 hover:underline" target="_blank">
            /blog
          </Link>{ " "}
          page.
        </p>
        <Link
          href="/blog"
          target="_blank"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-emerald-700"
        >
          <ExternalLink className="h-4 w-4" />
          View public blog
        </Link>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {success ? <MasterAlert variant="success" className="mb-4">{success}</MasterAlert> : null}

      <MasterCard className="mb-8 p-6 space-y-4">
        <h2 className="font-bold text-lg">Create new blog post</h2>
        <input
          className={masterInputClass}
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <input
          className={masterInputClass}
          placeholder="URL slug (optional — auto-generated from title)"
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
        />
        <CoverImageField
          value={form.coverImageUrl}
          onChange={(coverImageUrl) => setForm((f) => ({ ...f, coverImageUrl }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={masterInputClass}
            placeholder="SEO title"
            value={form.seoTitle}
            onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
          />
          <input
            className={masterInputClass}
            placeholder="SEO description"
            value={form.seoDescription}
            onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))}
          />
        </div>
        <input
          className={masterInputClass}
          placeholder="Short excerpt (shown on blog listing)"
          value={form.excerpt}
          onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
        />
        <textarea
          className={`${masterInputClass} min-h-[220px] font-mono text-sm`}
          placeholder="Body — markdown supported (**bold**, [links](url), lists)"
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
          />
          Publish immediately (show on public blog)
        </label>
        <button
          type="button"
          disabled={saving || !form.title.trim() || !form.body.trim()}
          className={masterBtnPrimary}
          onClick={() => void createPost()}
        >
          {saving ? "Saving…" : "Create blog post"}
        </button>
      </MasterCard>

      <MasterCard className="p-6">
        <h2 className="font-bold text-lg mb-4">All blog posts ({posts.length})</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-slate-500">
            No blog posts yet. Create one above — it will appear on /blog when published.
          </p>
        ) : (
          <ul className="space-y-4">
            {posts.map((post) => (
              <li key={post.id} className="rounded-lg border border-slate-200 p-4">
                {editingId === post.id ? (
                  <div className="space-y-3">
                    <input
                      className={masterInputClass}
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                    />
                    <input
                      className={masterInputClass}
                      placeholder="Slug"
                      value={editForm.slug}
                      onChange={(e) => setEditForm((f) => ({ ...f, slug: e.target.value }))}
                    />
                    <CoverImageField
                      value={editForm.coverImageUrl}
                      onChange={(url) => setEditForm((f) => ({ ...f, coverImageUrl: url }))}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        className={masterInputClass}
                        placeholder="SEO title"
                        value={editForm.seoTitle}
                        onChange={(e) => setEditForm((f) => ({ ...f, seoTitle: e.target.value }))}
                      />
                      <input
                        className={masterInputClass}
                        placeholder="SEO description"
                        value={editForm.seoDescription}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, seoDescription: e.target.value }))
                        }
                      />
                    </div>
                    <input
                      className={masterInputClass}
                      placeholder="Excerpt"
                      value={editForm.excerpt}
                      onChange={(e) => setEditForm((f) => ({ ...f, excerpt: e.target.value }))}
                    />
                    <textarea
                      className={`${masterInputClass} min-h-[220px] font-mono text-sm`}
                      value={editForm.body}
                      onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))}
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={editForm.isPublished}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, isPublished: e.target.checked }))
                        }
                      />
                      Published on public blog
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        className={masterBtnPrimary}
                        onClick={() => void saveEdit(post.id)}
                      >
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                      <button
                        type="button"
                        className="text-sm font-medium text-slate-600"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{post.title}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        <span
                          className={
                            post.isPublished
                              ? "font-semibold text-emerald-700"
                              : "font-semibold text-amber-700"
                          }
                        >
                          {post.isPublished ? "Published" : "Draft"}
                        </span>
                        {post.slug ? ` · /blog/${post.slug}` : " · no slug"}
                        {post.publishedAt
                          ? ` · ${new Date(post.publishedAt).toLocaleDateString()}`
                          : ""}
                      </p>
                      {post.excerpt ? (
                        <p className="mt-2 text-sm text-slate-600 line-clamp-2">{post.excerpt}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {post.isPublished && post.slug ? (
                        <Link
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          className="text-sm font-medium text-emerald-700 hover:underline"
                        >
                          View
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className="text-sm font-medium text-slate-700"
                        onClick={() => startEdit(post)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-sm font-medium text-slate-700"
                        onClick={() => void togglePublish(post)}
                      >
                        {post.isPublished ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        type="button"
                        className="text-sm font-medium text-red-600"
                        onClick={() => void deletePost(post.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </MasterCard>
    </>
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
        throw new Error(data.error ?? "Unable to upload image.");
      }
      onChange(data.url);
    } catch (uploadErr) {
      setUploadError(uploadErr instanceof Error ? uploadErr.message : "Unable to upload image.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start gap-2">
        <input
          className={`${masterInputClass} min-w-[min(100%,280px)] flex-1`}
          placeholder="Cover image URL or upload"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <label
          className={`shrink-0 cursor-pointer rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 ${
            uploading ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          {uploading ? "Uploading…" : "Upload image"}
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
      {isPreviewableImageUrl(value) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvePublicAssetUrl(value) ?? ""}
          alt=""
          className="max-h-40 rounded-lg border border-slate-200 object-cover"
        />
      ) : null}
      {uploadError ? <p className="text-xs text-red-600">{uploadError}</p> : null}
    </div>
  );
}
