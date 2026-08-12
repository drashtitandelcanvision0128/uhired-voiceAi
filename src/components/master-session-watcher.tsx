"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const WARNING_THRESHOLD_SEC = 5 * 60;

export function MasterSessionWatcher() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await fetch("/api/master/auth/session", { cache: "no-store" });
        const payload = (await response.json()) as {
          authenticated?: boolean;
          expiresInSec?: number;
        };

        if (!active) return;

        if (!payload.authenticated) {
          router.push("/master-login");
          return;
        }

        const expiresInSec = payload.expiresInSec ?? 0;
        if (expiresInSec > 0 && expiresInSec <= WARNING_THRESHOLD_SEC) {
          const minutes = Math.max(1, Math.ceil(expiresInSec / 60));
          setMessage(`Your master session expires in about ${minutes} minute${minutes === 1 ? "" : "s"}.`);
          setVisible(true);
        } else {
          setVisible(false);
          setMessage("");
        }
      } catch {
        // ignore transient errors
      }
    }

    void checkSession();
    const interval = window.setInterval(() => void checkSession(), 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [router]);

  if (!visible || !message) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg">
      <p className="text-sm font-semibold text-amber-900">Session expiring soon</p>
      <p className="mt-1 text-xs text-amber-800">{message}</p>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="mt-2 text-xs font-bold text-amber-900 underline"
      >
        Dismiss
      </button>
    </div>
  );
}
