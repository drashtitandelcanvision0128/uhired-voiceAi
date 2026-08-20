"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Mail, RefreshCw, Shield } from "lucide-react";
import { useToast } from "@/components/app-feedback";
import { MasterShell } from "@/components/master-shell";
import {
  MasterAlert,
  MasterCard,
  masterBtnPrimary,
  masterInputClass,
} from "@/components/master-ui";

type ProfileResponse = {
  email: string;
  role: string;
  initials: string;
  hasStoredAccount: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export default function MasterProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/master/profile");
      const payload = (await res.json()) as ProfileResponse & { error?: string };
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok) {
        setError(payload.error ?? "Unable to load profile.");
        return;
      }
      setProfile(payload);
      setNewEmail(payload.email);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(""), 3000);
    return () => window.clearTimeout(timer);
  }, [success]);

  async function saveProfile() {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await fetch("/api/master/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newEmail: newEmail.trim().toLowerCase() !== profile?.email ? newEmail.trim() : undefined,
          newPassword: newPassword.trim() || undefined,
          confirmPassword: confirmPassword.trim() || undefined,
        }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok || !payload.ok) {
        setError(payload.error ?? "Unable to update profile.");
        return;
      }
      setSuccess(payload.message ?? "Profile updated.");
      toast.success("Profile updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <MasterShell
      title="Profile"
      subtitle="Change your email or password."
      topActions={
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="admin-btn-ghost inline-flex items-center gap-2 !px-4 !py-2.5 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      }
    >
      <div className="space-y-5">
        {error ? <MasterAlert variant="error">{error}</MasterAlert> : null}
        {success ? <MasterAlert variant="success">{success}</MasterAlert> : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:items-start">
          <MasterCard
            title="Your login"
            subtitle="Current password is required to save changes."
            className="!p-6 sm:!p-8"
          >
            <div className="mb-6 flex items-start gap-4">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-primary-foreground shadow-[var(--shadow-glow)]"
                style={{ background: "var(--gradient-brand)" }}
                aria-hidden
              >
                {profile?.initials ?? "M"}
              </div>
              <div className="min-w-0">
                <p className="font-display text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
                  {profile?.role ?? "Master Admin"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{profile?.email ?? "—"}</p>
              </div>
            </div>

            <div className="space-y-6">
              <section className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="text-sm font-semibold text-foreground">Login email</span>
                  <div className="h-px flex-1 bg-border" aria-hidden />
                </div>
                <label className="block space-y-2">
                  <span className="admin-label">Email address</span>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(event) => setNewEmail(event.target.value)}
                      className={`${masterInputClass} w-full pl-10`}
                    />
                  </div>
                </label>
              </section>

              <section className="space-y-4 border-t border-border pt-6">
                <div className="flex items-center gap-3">
                  <KeyRound className="h-4 w-4 shrink-0 text-violet" aria-hidden />
                  <span className="text-sm font-semibold text-foreground">Change password</span>
                  <div className="h-px flex-1 bg-border" aria-hidden />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block space-y-2 md:col-span-2">
                    <span className="admin-label">Current password</span>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      placeholder="Required to save changes"
                      className={`${masterInputClass} w-full`}
                      autoComplete="current-password"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="admin-label">New password</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="At least 6 characters"
                      className={`${masterInputClass} w-full`}
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="admin-label">Confirm new password</span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Re-enter new password"
                      className={`${masterInputClass} w-full`}
                      autoComplete="new-password"
                    />
                  </label>
                </div>
              </section>

              <button
                type="button"
                onClick={() => void saveProfile()}
                disabled={saving || loading}
                className={`${masterBtnPrimary} gap-2 !px-5 disabled:opacity-60`}
              >
                <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                {saving ? "Saving…" : "Save profile"}
              </button>
            </div>
          </MasterCard>

          <div className="flex flex-col gap-4">
            <div className="admin-hero relative overflow-hidden rounded-2xl p-5 sm:p-6">
              <p className="text-muted-foreground text-sm leading-relaxed">
                This account controls the entire Uhired platform — companies, sessions, payments, and system
                settings.
              </p>
              <ul className="mt-5 space-y-3">
                {[
                  "Use a strong password unique to this master login.",
                  "Changing credentials does not sign out other sessions until logout.",
                  "Review login history under Security after any change.",
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-2.5">
                    <span className="bg-muted ring-border mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1">
                      <Check className="h-3 w-3 text-cyan" strokeWidth={3} aria-hidden />
                    </span>
                    <span className="text-sm leading-relaxed text-foreground">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            <MasterCard title="Account overview" className="!p-5 sm:!p-6">
              <ul className="space-y-4">
                <li className="flex gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/12 text-success ring-1 ring-success/25"
                    aria-hidden
                  >
                    <Mail className="h-4 w-4" strokeWidth={2.25} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Last login</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                      {profile?.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : "—"}
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning/12 text-warning ring-1 ring-warning/25"
                    aria-hidden
                  >
                    <RefreshCw className="h-4 w-4" strokeWidth={2.25} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Profile updated</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                      {profile?.updatedAt ? new Date(profile.updatedAt).toLocaleString() : "—"}
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet/12 text-violet ring-1 ring-violet/25"
                    aria-hidden
                  >
                    <Shield className="h-4 w-4" strokeWidth={2.25} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Security &amp; audit</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                      <a
                        href="/master/security"
                        className="font-semibold text-primary no-underline hover:text-cyan"
                      >
                        View security dashboard →
                      </a>
                    </p>
                  </div>
                </li>
              </ul>
            </MasterCard>
          </div>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Loading profile…</p> : null}
      </div>
    </MasterShell>
  );
}
