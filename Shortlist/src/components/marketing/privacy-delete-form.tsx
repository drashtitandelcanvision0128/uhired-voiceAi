"use client";

import { useState } from "react";
import Link from "next/link";

export function PrivacyDeleteForm() {
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [reason, setReason] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/privacy/delete-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          confirmEmail,
          reason: reason.trim() || undefined,
          honeypot,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
      if (!res.ok) {
        setStatus("error");
        setMessage(data?.error ?? "Unable to submit request.");
        return;
      }
      setStatus("success");
      setMessage(data?.message ?? "Your request was processed.");
      setEmail("");
      setConfirmEmail("");
      setReason("");
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-surface/50 p-6">
      <p className="text-sm text-slate-600">
        Request deletion of your <strong>practice interview</strong> data (transcripts, scores, recordings).
        Company hiring interviews are managed by the employer — we will log your request for follow-up.
      </p>

      <div className="hidden" aria-hidden="true">
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-slate-800">Email used for practice sessions</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="you@example.com"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-slate-800">Confirm email</span>
        <input
          type="email"
          required
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-slate-800">Reason (optional)</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Tell us why you are requesting deletion"
        />
      </label>

      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-lg bg-[#1d3557] px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        {status === "loading" ? "Submitting…" : "Request data deletion"}
      </button>

      {message ? (
        <p
          className={`text-sm ${status === "success" ? "text-emerald-700" : "text-red-600"}`}
          role="status"
        >
          {message}
        </p>
      ) : null}

      <p className="text-xs text-slate-500">
        See also our{" "}
        <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>.
      </p>
    </form>
  );
}
