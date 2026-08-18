"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { useAppFeedback } from "@/components/app-feedback";
import { AppSelect } from "@/components/ui/app-select";

type TeamMember = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  roleLabel: string;
  isActive: boolean;
  lastLoginAt: string | null;
};

const ROLES = ["ADMIN", "RECRUITER", "HIRING_MANAGER", "VIEWER"] as const;

export function AdminTeamPanel() {
  const { notify } = useAppFeedback();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("RECRUITER");
  const [saving, setSaving] = useState(false);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/team-members", { cache: "no-store" });
      const data = (await res.json()) as { members?: TeamMember[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Unable to load team.");
        setMembers([]);
        return;
      }
      setMembers(data.members ?? []);
    } catch {
      setError("Unable to load team.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/team-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Unable to add member.");
        notify.error(data.error ?? "Unable to add member.");
        return;
      }
      setEmail("");
      notify.created("Team member");
      await loadMembers();
    } catch {
      setError("Unable to add member.");
      notify.error("Unable to add member.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(member: TeamMember) {
    setError("");
    const res = await fetch(`/api/admin/team-members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !member.isActive }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      const message = data.error ?? "Unable to update member.";
      setError(message);
      notify.error(message);
      return;
    }
    notify.success(member.isActive ? "Team member deactivated." : "Team member activated.");
    await loadMembers();
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading team…</p>;
  }

  if (error && members.length === 0) {
    return <p className="text-sm text-slate-500">{error === "Forbidden." ? "Team management requires Admin role." : error}</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Team & roles</h3>
        <p className="mt-1 text-xs text-slate-500">
          Recruiters invite candidates; Hiring Managers create requirements; Viewers are read-only.
        </p>
      </div>

      {error ? <p className="sr-only">{error}</p> : null}

      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div>
              <p className="font-medium text-slate-900">{member.email}</p>
              <p className="text-xs text-slate-500">
                {member.roleLabel}
                {member.isActive ? "" : " · deactivated"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleActive(member)}
              className="text-xs font-semibold text-[#0052cc] hover:underline"
            >
              {member.isActive ? "Deactivate" : "Activate"}
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="recruiter@company.com"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Role</label>
          <AppSelect
            value={role}
            onValueChange={setRole}
            className="mt-1 min-w-[11rem]"
            aria-label="Member role"
            options={ROLES.map((r) => ({
              value: r,
              label: r.replace("_", " "),
            }))}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[#0052cc] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Add member
        </button>
      </form>
    </div>
  );
}
