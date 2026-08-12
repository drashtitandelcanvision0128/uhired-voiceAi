"use client";

import { useEffect, useState } from "react";

export function CompanyOidcButton() {
  const [authorizationUrl, setAuthorizationUrl] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/company-auth/oidc/start", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { enabled?: boolean; authorizationUrl?: string };
        if (data.enabled && data.authorizationUrl) {
          setAuthorizationUrl(data.authorizationUrl);
        }
      } catch {
        // OIDC not configured
      }
    })();
  }, []);

  if (!authorizationUrl) return null;

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-4">
      <a
        href={authorizationUrl}
        className="flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-[#0052cc] hover:text-[#0052cc]"
      >
        Sign in with your organization (SSO)
      </a>
    </div>
  );
}
