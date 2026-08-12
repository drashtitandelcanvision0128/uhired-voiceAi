"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfirm, useToast } from "@/components/app-feedback";
import { MasterShell } from "@/components/master-shell";
import { MasterCard, MasterAlert, masterBtnPrimary, masterInputClass } from "@/components/master-ui";

type JobPage = {
  id: string;
  title: string;
  excerpt: string | null;
  body: string;
  location: string | null;
  employmentType: string | null;
  isPublished: boolean;
  publishedAt: string | null;
};

const emptyForm = {
  title: "",
  excerpt: "",
  body: "",
  location: "",
  employmentType: "Full-time",
  isPublished: true,
};

export default function MasterCareersContentPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [pages, setPages] = useState<JobPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadPages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/master/content-pages?type=JOB", { cache: "no-store" });
      const data = (await res.json()) as { pages?: JobPage[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Unable to load careers listings.");
        return;
      }
      setPages(data.pages ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPages();
  }, [loadPages]);

  function startEdit(page: JobPage) {
    setEditingId(page.id);
    setEditForm({
      title: page.title,
      excerpt: page.excerpt ?? "",
      body: page.body,
      location: page.location ?? "",
      employmentType: page.employmentType ?? "Full-time",
      isPublished: page.isPublished,
    });
    setError("");
    setSuccess("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyForm);
  }

  async function createPage() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/master/content-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "JOB",
          title: form.title,
          excerpt: form.excerpt,
          body: form.body,
          location: form.location,
          employmentType: form.employmentType,
          isPublished: form.isPublished,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Unable to create.");
        return;
      }
      setSuccess("Job opening created.");
      toast.success("Job opening created successfully.");
      setForm(emptyForm);
      await loadPages();
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(pageId: string) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/master/content-pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          excerpt: editForm.excerpt,
          body: editForm.body,
          location: editForm.location,
          employmentType: editForm.employmentType,
          isPublished: editForm.isPublished,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Unable to save.");
        return;
      }
      setSuccess("Changes saved.");
      toast.success("Job opening updated successfully.");
      cancelEdit();
      await loadPages();
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(page: JobPage) {
    const res = await fetch(`/api/master/content-pages/${page.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !page.isPublished }),
    });
    if (res.ok) {
      toast.success(page.isPublished ? "Job opening unpublished." : "Job opening published successfully.");
      await loadPages();
    }
  }

  async function deletePage(id: string) {
    const ok = await confirm({
      title: "Delete job opening?",
      message: "This permanently removes the job listing from careers. This action cannot be undone.",
      confirmLabel: "Delete opening",
      variant: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/master/content-pages/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Unable to delete job opening.");
      return;
    }
    if (editingId === id) cancelEdit();
    toast.success("Job opening deleted successfully.");
    await loadPages();
  }

  return (
    <MasterShell
      title="Careers CMS"
      subtitle="Manage job openings shown on the public /careers page."
    >
      {error ? <MasterAlert variant="error" className="mb-4">{error}</MasterAlert> : null}
      {success ? <MasterAlert variant="success" className="mb-4">{success}</MasterAlert> : null}

      <MasterCard className="mb-8 p-6 space-y-4">
        <h2 className="font-bold text-lg">Create job opening</h2>
        <input
          className={masterInputClass}
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={masterInputClass}
            placeholder="Location"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          />
          <input
            className={masterInputClass}
            placeholder="Employment type"
            value={form.employmentType}
            onChange={(e) => setForm((f) => ({ ...f, employmentType: e.target.value }))}
          />
        </div>
        <input
          className={masterInputClass}
          placeholder="Short excerpt"
          value={form.excerpt}
          onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
        />
        <textarea
          className={`${masterInputClass} min-h-[200px]`}
          placeholder="Job description"
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isPublished}
            onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
          />
          Publish immediately
        </label>
        <button
          type="button"
          disabled={saving || !form.title.trim() || !form.body.trim()}
          className={masterBtnPrimary}
          onClick={() => void createPage()}
        >
          {saving ? "Saving…" : "Create"}
        </button>
      </MasterCard>

      <MasterCard className="p-6">
        <h2 className="font-bold text-lg mb-4">Existing openings</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : pages.length === 0 ? (
          <p className="text-sm text-slate-500">No job openings yet.</p>
        ) : (
          <ul className="space-y-4">
            {pages.map((page) => (
              <li key={page.id} className="rounded-lg border border-slate-200 p-4">
                {editingId === page.id ? (
                  <div className="space-y-3">
                    <input
                      className={masterInputClass}
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        className={masterInputClass}
                        value={editForm.location}
                        onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                      />
                      <input
                        className={masterInputClass}
                        value={editForm.employmentType}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, employmentType: e.target.value }))
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
                      className={`${masterInputClass} min-h-[200px]`}
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
                      Published
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        className={masterBtnPrimary}
                        onClick={() => void saveEdit(page.id)}
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{page.title}</p>
                      <p className="text-xs text-slate-500">
                        {page.isPublished ? "Published" : "Draft"}
                        {page.location ? ` · ${page.location}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-sm font-medium text-slate-700"
                        onClick={() => startEdit(page)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-sm font-medium text-slate-700"
                        onClick={() => void togglePublish(page)}
                      >
                        {page.isPublished ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        type="button"
                        className="text-sm font-medium text-red-600"
                        onClick={() => void deletePage(page.id)}
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
    </MasterShell>
  );
}
