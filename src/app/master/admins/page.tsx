"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Plus, Shield, Trash2, UserPlus } from "lucide-react";
import { useConfirm, useToast } from "@/components/app-feedback";
import { MasterShell } from "@/components/master-shell";
import {
  MasterAlert,
  MasterCard,
  masterBtnPrimary,
  masterInputClass,
} from "@/components/master-ui";

type AdminRow = {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  isCurrent: boolean;
};

type AdminsResponse = {
  currentEmail: string | null;
  admins: AdminRow[];
};

export default function MasterAdminsPage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/master/admins");
      const payload = (await res.json()) as AdminsResponse & { error?: string };
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok) {
        setError(payload.error ?? "Unable to load master admins.");
        return;
      }
      setAdmins(payload.admins ?? []);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(""), 3500);
    return () => window.clearTimeout(timer);
  }, [success]);

  async function createAdmin() {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await fetch("/api/master/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          confirmPassword,
        }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok || !payload.ok) {
        setError(payload.error ?? "Unable to create master admin.");
        return;
      }
      setSuccess(payload.message ?? "Master admin created.");
      toast.success("Master admin created.");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function removeAdmin(admin: AdminRow) {
    if (admin.isCurrent) {
      setError("You cannot delete the account you are currently signed in with.");
      return;
    }
    const ok = await confirm({
      title: `Delete master admin ${admin.email}?`,
      message: "They will no longer be able to sign in to the master portal.",
      confirmLabel: "Delete admin",
      variant: "danger",
    });
    if (!ok) return;

    setError("");
    const res = await fetch(`/api/master/admins/${admin.id}`, { method: "DELETE" });
    const payload = (await res.json()) as { ok?: boolean; error?: string; message?: string };
    if (res.status === 401) {
      router.push("/master-login");
      return;
    }
    if (!res.ok || !payload.ok) {
      setError(payload.error ?? "Unable to delete master admin.");
      return;
    }
    setSuccess(payload.message ?? "Master admin deleted.");
    toast.success("Master admin deleted.");
    await load();
  }

  return (
    <MasterShell
      title="Master admins"
      subtitle="Create additional master admin accounts for platform access."
    >
      <div className="space-y-6">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}
        {success ? <MasterAlert variant="success">{success}</MasterAlert> : null}

        <MasterCard>
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="size-4 text-primary" aria-hidden />
            <h2 className="text-base font-semibold text-foreground">Create master admin</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="master-admin-email" className="text-sm font-semibold text-foreground">
                Email
              </label>
              <input
                id="master-admin-email"
                type="email"
                autoComplete="off"
                className={masterInputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="master-admin-password" className="text-sm font-semibold text-foreground">
                Password
              </label>
              <div className="relative">
                <input
                  id="master-admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className={`${masterInputClass} pr-10`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                />
                <button
                  type="button"
                  className="text-muted-foreground absolute inset-y-0 right-2 my-auto rounded-md p-1.5"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="master-admin-confirm-password"
                className="text-sm font-semibold text-foreground"
              >
                Confirm password
              </label>
              <input
                id="master-admin-confirm-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                className={masterInputClass}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
              />
            </div>
          </div>
          <div className="mt-5">
            <button
              type="button"
              className={masterBtnPrimary}
              disabled={saving || !email.trim() || password.length < 6}
              onClick={() => void createAdmin()}
            >
              <Plus className="size-4" aria-hidden />
              {saving ? "Creating…" : "Create master admin"}
            </button>
          </div>
        </MasterCard>

        <MasterCard>
          <div className="mb-4 flex items-center gap-2">
            <Shield className="size-4 text-primary" aria-hidden />
            <h2 className="text-base font-semibold text-foreground">Existing master admins</h2>
          </div>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : admins.length === 0 ? (
            <p className="text-muted-foreground text-sm">No master admin accounts found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Email</th>
                    <th className="px-2 py-2 font-medium">Created</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin) => (
                    <tr key={admin.id} className="border-b border-border/70">
                      <td className="px-2 py-3 font-medium text-foreground">{admin.email}</td>
                      <td className="px-2 py-3 text-muted-foreground">
                        {new Date(admin.createdAt).toLocaleString()}
                      </td>
                      <td className="px-2 py-3">
                        {admin.isCurrent ? (
                          <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                            Signed in
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Active</span>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-40"
                          disabled={admin.isCurrent || admins.length <= 1}
                          onClick={() => void removeAdmin(admin)}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </MasterCard>
      </div>
    </MasterShell>
  );
}
