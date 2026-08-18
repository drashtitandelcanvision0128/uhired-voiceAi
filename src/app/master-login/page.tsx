"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, BarChart3, Building2, Loader2, Shield } from "lucide-react";
import { AuthShell, Field } from "@/components/marketing/site/AuthShell";

type LoginContext = {
  environmentLabel?: string;
  environmentBadgeClass?: string;
  lastSuccessfulLogin?: string | null;
  maskedAdminEmail?: string | null;
};

function formatLastLogin(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

const masterHighlights = [
  {
    Icon: Building2,
    title: "All companies in one place",
    copy: "See every company, their interviews, and hiring activity.",
  },
  {
    Icon: Activity,
    title: "Live interviews & support",
    copy: "Track ongoing interviews, payments, and support tickets.",
  },
  {
    Icon: BarChart3,
    title: "Reports & platform health",
    copy: "Check interview numbers, revenue, and whether the platform is running well.",
  },
  {
    Icon: Shield,
    title: "Secure master login",
    copy: "Protected sign-in with login history and trusted devices.",
  },
];

export default function MasterLoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [loginContext, setLoginContext] = useState<LoginContext | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/master/auth/context", { cache: "no-store" });
        if (!res.ok) return;
        setLoginContext((await res.json()) as LoginContext);
      } catch {
        // ignore
      }
    })();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const adminEmail = String(form.get("adminEmail") ?? "").trim().toLowerCase();
    const passcode = String(form.get("passcode") ?? "").trim();

    if (!adminEmail || !passcode) {
      setError("Email and password are required.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/master/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail, passcode, trustDevice }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Sign in failed. Check your credentials.");
        return;
      }
      router.push("/master/dashboard");
    } catch {
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Master login"
      title={
        <>
          Welcome back to <span className="text-gradient">Master Control</span>
        </>
      }
      subtitle="Sign in to manage companies, interviews, payments, and platform settings."
      highlights={masterHighlights}
      footer={
        <>
          <Link href="/" className="font-semibold text-primary hover:text-cyan no-underline">
            ← Back to public site
          </Link>
          <p className="mt-3">
            Having trouble?{" "}
            <Link href="/contact" className="font-semibold text-primary hover:text-cyan no-underline">
              Contact system administrator
            </Link>
          </p>
        </>
      }
    >
      {loginContext?.environmentLabel ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] tracking-[0.2em] uppercase ${loginContext.environmentBadgeClass ?? "border-border bg-surface/70 text-muted-foreground"}`}
          >
            {loginContext.environmentLabel}
          </span>
        </div>
      ) : null}

      {loginContext?.lastSuccessfulLogin ? (
        <div className="mb-4 rounded-xl border border-border bg-surface/50 px-4 py-3 text-sm text-muted-foreground">
          Last successful sign-in:{" "}
          <span className="font-medium text-foreground">{formatLastLogin(loginContext.lastSuccessfulLogin)}</span>
          {loginContext.maskedAdminEmail ? (
            <>
              {" "}
              as <span className="font-medium text-foreground">{loginContext.maskedAdminEmail}</span>
            </>
          ) : null}
        </div>
      ) : null}

      <form className="grid gap-4" onSubmit={onSubmit}>
        <Field
          label="Email"
          type="email"
          name="adminEmail"
          required
          placeholder="master@uhired.com"
          autoComplete="username"
        />
        <Field
          label="Password"
          type="password"
          name="passcode"
          required
          placeholder="••••••••"
          autoComplete="current-password"
        />
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(e) => setTrustDevice(e.target.checked)}
            className="h-4 w-4 rounded border-border bg-surface accent-primary"
          />
          Keep me signed in on this device for 30 days
        </label>
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
