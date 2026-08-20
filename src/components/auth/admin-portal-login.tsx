"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Lock,
  Mail,
  Eye,
  EyeOff,
  LineChart,
  Shield,
  Network,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

const FIELD_LABEL_CLASS =
  "block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500";

const INPUT_CLASS =
  "w-full rounded-lg border border-slate-200 bg-[#f4f6f8] py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#0052cc] focus:bg-white focus:ring-2 focus:ring-[#0052cc]/15";

const DEFAULT_FEATURES: Array<{
  icon: LucideIcon;
  title: string;
  description: string;
}> = [
  {
    icon: LineChart,
    title: "Advanced Talent Analytics",
    description:
      "Gain deep insights into candidate performance with AI-driven clarity and precision data points.",
  },
  {
    icon: Shield,
    title: "Institutional Reliability",
    description:
      "Enterprise-grade security ensuring all session data and institutional IP remains strictly confidential.",
  },
  {
    icon: Network,
    title: "Structured Hiring Workflows",
    description:
      "Create role requirements, invite candidates in bulk, and review AI scorecards from one dashboard.",
  },
];

type LoginContext = {
  environmentLabel?: string;
  environmentBadgeClass?: string;
  lastSuccessfulLogin?: string | null;
  maskedAdminEmail?: string | null;
};

function UhiredLogo({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const onDark = variant === "dark";
  return (
    <BrandLogo
      href="/"
      variant={onDark ? "white" : "black"}
      markSize={32}
      title="Uhired"
      withAiSuffix={false}
      wordmarkClassName={onDark ? "text-xl font-bold tracking-tight text-white" : "text-xl font-bold tracking-tight text-[#0052cc]"}
    />
  );
}

function formatLastLogin(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export type AdminPortalLoginProps = {
  title: string;
  subtitle: string;
  submitLabel: string;
  loginEndpoint: string;
  redirectTo: string;
  emailFieldName?: string;
  passwordFieldName?: string;
  showForgotLink?: boolean;
  forgotLinkHref?: string;
  footer?: ReactNode;
  headline?: string;
  portalBadge?: string;
  features?: Array<{ icon: LucideIcon; title: string; description: string }>;
  contextEndpoint?: string;
  enableTrustDevice?: boolean;
  trustDeviceLabel?: string;
  backLink?: { href: string; label: string };
};

export function AdminPortalLogin({
  title,
  subtitle,
  submitLabel,
  loginEndpoint,
  redirectTo,
  emailFieldName = "companyEmail",
  passwordFieldName = "passcode",
  showForgotLink = true,
  forgotLinkHref = "/company-login/forgot-passcode",
  footer,
  headline = "Elevate Your Engineering Excellence.",
  portalBadge,
  features = DEFAULT_FEATURES,
  contextEndpoint,
  enableTrustDevice = false,
  trustDeviceLabel = "Trust this device for 30 days",
  backLink,
}: AdminPortalLoginProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPasscode, setShowPasscode] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  const [loginContext, setLoginContext] = useState<LoginContext | null>(null);

  useEffect(() => {
    if (!contextEndpoint) return;
    void (async () => {
      try {
        const response = await fetch(contextEndpoint, { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as LoginContext & {
          environmentLabel: string;
          environmentBadgeClass: string;
        };
        setLoginContext(payload);
      } catch {
        // ignore
      }
    })();
  }, [contextEndpoint]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get(emailFieldName) ?? "")
      .trim()
      .toLowerCase();
    const password = String(formData.get(passwordFieldName) ?? "").trim();

    if (!email || !password) {
      setError("Email and password are required.");
      setLoading(false);
      return;
    }

    const response = await fetch(loginEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [emailFieldName]: email,
        [passwordFieldName]: password,
        ...(enableTrustDevice ? { trustDevice } : {}),
      }),
    });
    const data = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !data.ok) {
      setError(data.error ?? "Unable to sign in.");
      setLoading(false);
      return;
    }

    router.push(redirectTo);
  }

  return (
    <main className="min-h-dvh grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <section className="relative hidden overflow-hidden bg-gradient-to-b from-[#0a2d52] via-[#062038] to-[#001428] px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-[#0d4a7a]/40 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-20 h-64 w-64 rounded-full bg-[#0052cc]/10 blur-3xl" />

        <div className="relative z-10 space-y-4">
          <UhiredLogo variant="dark" />
          {portalBadge ? (
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/80">
              {portalBadge}
            </span>
          ) : null}
        </div>

        <div className="relative z-10 max-w-md space-y-10 py-8">
          <h1 className="text-[2.35rem] font-bold leading-[1.15] tracking-tight">{headline}</h1>

          <ul className="space-y-7">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <li key={feature.title} className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10">
                    <Icon className="h-5 w-5 text-white" aria-hidden="true" />
                  </span>
                  <div className="space-y-1.5 pt-0.5">
                    <p className="text-sm font-semibold text-white">{feature.title}</p>
                    <p className="text-sm leading-relaxed text-white/65">{feature.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="relative z-10 flex items-center justify-between gap-4 text-[10px] font-medium uppercase tracking-[0.16em] text-white/35">
          <span>© 2024 Uhired AI Global</span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="transition-colors hover:text-white/60">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white/60">
              Terms
            </Link>
            <Link href="/contact" className="transition-colors hover:text-white/60">
              Compliance
            </Link>
          </div>
        </div>
      </section>

      <section className="flex min-h-dvh flex-col bg-white px-6 py-10 sm:px-10 lg:px-14 lg:py-12">
        <div className="mb-8 flex items-center justify-between gap-4 lg:hidden">
          <UhiredLogo variant="light" />
          {loginContext?.environmentLabel ? (
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${loginContext.environmentBadgeClass ?? "border-slate-200 bg-slate-50 text-slate-600"}`}
            >
              {loginContext.environmentLabel}
            </span>
          ) : null}
        </div>

        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center">
          <div className="mb-8">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {portalBadge ? (
                <span className="rounded-full border border-[#c7d7f5] bg-[#eef4ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#1d3557]">
                  {portalBadge}
                </span>
              ) : null}
              {loginContext?.environmentLabel ? (
                <span
                  className={`hidden rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] lg:inline-flex ${loginContext.environmentBadgeClass ?? "border-slate-200 bg-slate-50 text-slate-600"}`}
                >
                  {loginContext.environmentLabel}
                </span>
              ) : null}
            </div>
            <h2 className="text-[1.65rem] font-bold tracking-tight text-slate-900">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{subtitle}</p>
            {loginContext?.lastSuccessfulLogin ? (
              <p className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Last successful sign-in:{" "}
                <span className="font-semibold text-slate-700">
                  {formatLastLogin(loginContext.lastSuccessfulLogin)}
                </span>
                {loginContext.maskedAdminEmail ? (
                  <>
                    {" "}
                    as <span className="font-semibold text-slate-700">{loginContext.maskedAdminEmail}</span>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor={emailFieldName} className={FIELD_LABEL_CLASS}>
                Email
              </label>
              <div className="group relative">
                <Mail
                  className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id={emailFieldName}
                  name={emailFieldName}
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="admin@acme.ai"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={passwordFieldName} className={FIELD_LABEL_CLASS}>
                  Password
                </label>
                {showForgotLink ? (
                  <Link
                    href={forgotLinkHref}
                    className="text-xs font-semibold text-[#0052cc] transition-colors hover:text-[#0044b0]"
                  >
                    Forgot?
                  </Link>
                ) : null}
              </div>
              <div className="group relative">
                <Lock
                  className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id={passwordFieldName}
                  name={passwordFieldName}
                  type={showPasscode ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••••"
                  className={`${INPUT_CLASS} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 focus:text-[#0052cc] focus:outline-none"
                  aria-label={showPasscode ? "Hide passcode" : "Show passcode"}
                >
                  {showPasscode ? (
                    <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {enableTrustDevice ? (
              <label className="flex cursor-pointer items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  checked={trustDevice}
                  onChange={(event) => setTrustDevice(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#0052cc] focus:ring-[#0052cc]/20"
                />
                <span className="text-sm text-slate-500">{trustDeviceLabel}</span>
              </label>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3">
                <p className="text-sm font-medium text-red-600">{error}</p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0052cc] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#0047b8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in...
                </>
              ) : (
                <>
                  {submitLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {footer}

          {backLink ? (
            <p className="mt-6 text-center text-sm text-slate-500">
              <Link href={backLink.href} className="font-semibold text-[#0052cc] hover:text-[#0044b0]">
                ← {backLink.label}
              </Link>
            </p>
          ) : null}

          <div className="mt-10 flex items-center justify-center gap-8 border-t border-slate-100 pt-8">
            {["SOC 2", "ISO 27001", "GDPR"].map((badge) => (
              <div
                key={badge}
                className="flex h-8 items-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300"
                aria-hidden="true"
              >
                {badge}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
