"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { AuthShell, Field } from "@/components/marketing/site/AuthShell";

const perks = ["Free company workspace", "AI voice interviews", "Structured evaluation & reports"];

export default function CompanyRegisterPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const companyName = String(form.get("companyName") ?? "").trim();
    const companyDomain = String(form.get("companyDomain") ?? "").trim();
    const companyEmail = String(form.get("companyEmail") ?? "").replace(/\s+/g, "").toLowerCase();
    const passcode = String(form.get("passcode") ?? "").replace(/\s+/g, "");
    const confirmPasscode = String(form.get("confirmPasscode") ?? "").replace(/\s+/g, "");
    const honeypot = String(form.get("honeypot") ?? "").trim();

    if (!companyName || !companyDomain || !companyEmail || !passcode || !confirmPasscode) {
      setError("All fields are required.");
      setBusy(false);
      return;
    }
    if (passcode.length < 6) {
      setError("Passcode must be at least 6 characters.");
      setBusy(false);
      return;
    }
    if (passcode !== confirmPasscode) {
      setError("Passcodes do not match.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/company-auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, companyDomain, companyEmail, passcode, honeypot }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Unable to register company.");
        return;
      }
      router.push("/admin/dashboard");
    } catch {
      setError("Unable to register right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Company registration"
      title={
        <>
          Register your <span className="text-gradient">AI hiring</span> workspace
        </>
      }
      subtitle="Create your corporate admin account to access the Uhired dashboard and start running AI voice interviews."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/company-login" className="font-semibold text-primary hover:text-cyan no-underline">
            Sign in
          </Link>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        <input type="text" name="honeypot" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <Field label="Company name" name="companyName" required placeholder="Acme Inc." autoComplete="organization" />
        <Field label="Corporate domain" name="companyDomain" required placeholder="acme.com" />
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
          placeholder="At least 6 characters"
          autoComplete="new-password"
          minLength={6}
        />
        <Field
          label="Confirm passcode"
          type="password"
          name="confirmPasscode"
          required
          placeholder="Repeat passcode"
          autoComplete="new-password"
          minLength={6}
        />
        <ul className="grid gap-2 pt-1">
          {perks.map((p, i) => (
            <li
              key={p}
              className="animate-rise-left flex items-center gap-2 text-xs text-muted-foreground"
              style={{ animationDelay: String(120 + i * 90) + "ms" }}
            >
              <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" /> {p}
            </li>
          ))}
        </ul>
        <button
          type="submit"
          disabled={busy}
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-70"
          style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-glow)" }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Create company account <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </form>
    </AuthShell>
  );
}
