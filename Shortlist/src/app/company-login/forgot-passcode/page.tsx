"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { AuthShell, Field, TextareaField } from "@/components/marketing/site/AuthShell";

const SUPPORT_EMAIL = "no-reply@uhired.in";

export default function ForgotPasscodePage() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const companyName = String(formData.get("companyName") ?? "").trim();
    const companyDomain = String(formData.get("companyDomain") ?? "").trim();
    const companyEmail = String(formData.get("companyEmail") ?? "").trim().toLowerCase();
    const message = String(formData.get("message") ?? "").trim();
    const honeypot = String(formData.get("honeypot") ?? "").trim();

    if (!companyName || !companyDomain || !companyEmail) {
      setError("Company name, domain, and admin email are required.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyName,
          email: companyEmail,
          subject: "Company admin passcode reset request",
          message: [
            "A company admin has requested a passcode reset.",
            "",
            `Company: ${companyName}`,
            `Domain: ${companyDomain}`,
            `Admin email: ${companyEmail}`,
            "",
            message || "Please reset my company admin passcode.",
          ].join("\n"),
          honeypot,
        }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        setError(data.error ?? "Unable to submit your request. Please try again.");
        return;
      }

      setSuccess(
        "Request sent. Our support team will verify your account details and email you a new passcode.",
      );
      event.currentTarget.reset();
    } catch {
      setError("Unable to submit your request. Please try again or email support directly.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Passcode recovery"
      title={
        <>
          Forgot your <span className="text-gradient">passcode?</span>
        </>
      }
      subtitle="Company admin passcodes are managed by Uhired support. Submit your account details and we'll verify your identity before issuing a new passcode."
      footer={
        <>
          <Link href="/company-login" className="font-semibold text-primary hover:text-cyan no-underline">
            ← Back to company login
          </Link>
          <p className="mt-3">
            Or email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary hover:text-cyan no-underline">
              {SUPPORT_EMAIL}
            </a>{" "}
            directly.
          </p>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <input type="text" name="honeypot" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <Field label="Company name" name="companyName" required placeholder="Acme Inc." autoComplete="organization" />
        <Field label="Company domain" name="companyDomain" required placeholder="acme.com" />
        <Field
          label="Company admin email"
          type="email"
          name="companyEmail"
          required
          placeholder="admin@company.com"
          autoComplete="username"
        />
        <TextareaField
          label="Additional details (optional)"
          name="message"
          rows={3}
          placeholder="Anything else that helps us verify your account"
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {success ? <p className="text-xs text-success">{success}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-70"
          style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-glow)" }}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Request passcode reset <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </AuthShell>
  );
}
