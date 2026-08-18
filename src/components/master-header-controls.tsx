"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  HelpCircle,
  LogOut,
  Moon,
  Settings,
  Sun,
  User,
} from "lucide-react";

import {
  applySiteTheme,
  readStoredSiteTheme,
  type SiteTheme,
} from "@/lib/site-theme";

type MasterTheme = SiteTheme;

type HeaderNotification = {
  id: string;
  title: string;
  body: string;
  time: string;
  href?: string;
  unread?: boolean;
};

type HeaderResponse = {
  profile: {
    email: string;
    role: string;
    initials: string;
  };
  notifications: HeaderNotification[];
  unreadCount: number;
};

type MasterHeaderControlsProps = {
  onLogout: () => Promise<void>;
  middleActions?: React.ReactNode;
};

export function MasterHeaderControls({ onLogout, middleActions }: MasterHeaderControlsProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<MasterTheme>("dark");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [headerData, setHeaderData] = useState<HeaderResponse | null>(null);

  const applyTheme = useCallback((next: MasterTheme) => {
    setTheme(next);
    applySiteTheme(next);
  }, []);

  const loadHeader = useCallback(async () => {
    try {
      const res = await fetch("/api/master/header", { cache: "no-store" });
      if (res.status === 401) {
        router.push("/master-login");
        return;
      }
      if (!res.ok) return;
      const payload = (await res.json()) as HeaderResponse;
      setHeaderData(payload);
    } catch {
      // ignore transient errors
    }
  }, [router]);

  useEffect(() => {
    applyTheme(readStoredSiteTheme() ?? "dark");
  }, [applyTheme]);

  useEffect(() => {
    void loadHeader();
    const interval = window.setInterval(() => void loadHeader(), 60_000);
    return () => window.clearInterval(interval);
  }, [loadHeader]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const unreadCount = useMemo(
    () => headerData?.unreadCount ?? headerData?.notifications.filter((item) => item.unread).length ?? 0,
    [headerData],
  );

  const profile = headerData?.profile ?? {
    email: "master@uhired.in",
    role: "Master Admin",
    initials: "M",
  };

  return (
    <div className="relative flex shrink-0 items-center gap-2 sm:gap-3" ref={menuRef}>
      <div
        className="flex items-center rounded-lg border border-border bg-background p-0.5"
        role="group"
        aria-label="Theme"
      >
        <button
          type="button"
          onClick={() => applyTheme("light")}
          className={`rounded-md p-1.5 transition ${
            theme === "light"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Light theme"
          aria-pressed={theme === "light"}
        >
          <Sun className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => applyTheme("dark")}
          className={`rounded-md p-1.5 transition ${
            theme === "dark"
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Dark theme"
          aria-pressed={theme === "dark"}
        >
          <Moon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setNotificationsOpen((open) => !open);
            setProfileMenuOpen(false);
          }}
          className="text-muted-foreground hover:bg-muted hover:text-foreground relative rounded-lg p-2 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
              {unreadCount}
            </span>
          ) : null}
        </button>

        {notificationsOpen ? (
          <div className="admin-card absolute right-0 z-50 mt-2 w-80 overflow-hidden !rounded-xl !p-0 shadow-xl ring-1 ring-border">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-bold text-foreground">Notifications</p>
              <p className="text-[11px] text-muted-foreground">Live platform activity</p>
            </div>
            <ul className="max-h-72 overflow-y-auto">
              {(headerData?.notifications ?? []).map((item) => (
                <li key={item.id} className="border-b border-border last:border-0">
                  {item.href ? (
                    <Link
                      href={item.href}
                      onClick={() => setNotificationsOpen(false)}
                      className="block px-4 py-3 no-underline transition hover:bg-surface/60"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                          {item.time}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                    </Link>
                  ) : (
                    <div className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                          {item.time}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="border-t border-border px-3 py-2">
              <Link
                href="/master/logs"
                onClick={() => setNotificationsOpen(false)}
                className="block rounded-lg px-3 py-2 text-xs font-bold text-foreground no-underline hover:bg-surface/60"
              >
                View activity logs →
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {middleActions}

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setProfileMenuOpen((open) => !open);
            setNotificationsOpen(false);
          }}
          className="hover:bg-muted flex items-center gap-2 rounded-lg border border-border bg-background py-1 pl-1 pr-2 transition"
          aria-label="Profile menu"
        >
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-primary-foreground"
            style={{ background: "var(--gradient-brand)" }}
            aria-hidden
          >
            {profile.initials}
          </div>
          <span className="hidden max-w-[120px] truncate text-sm font-semibold text-foreground sm:block">
            {profile.role}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </button>

        {profileMenuOpen ? (
          <div className="admin-card absolute right-0 z-50 mt-2 w-56 overflow-hidden !rounded-xl !p-0 shadow-xl ring-1 ring-border">
            <div className="border-b border-border px-4 py-3">
              <p className="truncate text-sm font-bold text-foreground">{profile.role}</p>
              <p className="truncate text-[11px] text-muted-foreground">{profile.email}</p>
            </div>
            <Link
              href="/master/profile"
              onClick={() => setProfileMenuOpen(false)}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-foreground no-underline transition hover:bg-surface/60"
            >
              <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Profile
            </Link>
            <Link
              href="/master/system-settings"
              onClick={() => setProfileMenuOpen(false)}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-foreground no-underline transition hover:bg-surface/60"
            >
              <Settings className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              System Settings
            </Link>
            <Link
              href="/master/help-center"
              onClick={() => setProfileMenuOpen(false)}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-foreground no-underline transition hover:bg-surface/60"
            >
              <HelpCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Help Center
            </Link>
            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false);
                applyTheme(theme === "dark" ? "light" : "dark");
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-foreground transition hover:bg-surface/60"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              )}
              {theme === "dark" ? "Light theme" : "Dark theme"}
            </button>
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false);
                void onLogout();
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-destructive transition hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Logout
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
