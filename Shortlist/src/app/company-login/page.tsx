"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { AuthShell, Field } from "@/components/marketing/site/AuthShell";

export default function CompanyLoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const companyEmail = String(form.get("companyEmail") ?? "").trim().toLowerCase();
    const passcode = String(form.get("passcode") ?? "").trim();

    if (!companyEmail || !passcode) {
      setError("Email and passcode are required.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/company-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyEmail, passcode }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Sign in failed. Check your credentials.");
        return;
      }
      router.push("/admin");
    } catch {
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Company login"
      title={
        <>
          Welcome back to <span className="text-gradient">Uhired AI</span>
        </>
      }
      subtitle="Enter your corporate credentials to access the recruiter dashboard, scorecards, and hiring pipeline."
      footer={
        <>
          <p>
            Don&apos;t have an account?{" "}
            <Link href="/company-register" className="font-semibold text-primary hover:text-cyan no-underline">
              Register your company
            </Link>
          </p>
          <p className="mt-3">
            Having trouble?{" "}
            <Link href="/contact" className="font-semibold text-primary hover:text-cyan no-underline">
              Contact support
            </Link>
          </p>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        <Field
          label="Work email"
          type="email"
          name="companyEmail"
          required
          placeholder="admin@company.com"
          autoComplete="username"
        />
        <Field
          label="Portal passcode"
          type="password"
          name="passcode"
          required
          placeholder="••••••••"
          autoComplete="current-password"
        />
        <div className="flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 text-muted-foreground">
            <input type="checkbox" className="h-4 w-4 rounded border-border bg-surface accent-primary" /> Keep me
            signed in
          </label>
          <Link href="/company-login/forgot-passcode" className="text-primary hover:text-cyan no-underline">
            Forgot passcode?
          </Link>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-70"
          style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-glow)" }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Continue to dashboard <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </form>
    </AuthShell>
  );
}
