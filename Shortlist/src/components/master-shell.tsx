"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  Building2,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Newspaper,
  ScrollText,
  Settings,
  Shield,
  ShieldAlert,
  TicketPercent,
  User,
} from "lucide-react";
import { MasterGlobalSearch } from "@/components/master-global-search";
import { MasterHeaderControls } from "@/components/master-header-controls";
import { AdminPortalLogo } from "@/components/admin-portal-logo";

type MasterShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  topActions?: React.ReactNode;
};

const platformNavItems = [
  { href: "/master/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/master/companies", label: "Company Management", icon: Building2 },
  { href: "/master/company-sessions", label: "Company Interviews", icon: Briefcase },
  { href: "/master/interview-analytics", label: "Interview Analytics", icon: BarChart3 },
  { href: "/master/practice-sessions", label: "Practice Sessions", icon: ScrollText },
  { href: "/master/stuck-sessions", label: "Stuck Sessions", icon: AlertTriangle },
  { href: "/master/payments", label: "Payments", icon: CreditCard },
  { href: "/master/promo-codes", label: "Promo Codes", icon: TicketPercent },
  { href: "/master/user-analytics", label: "User Analytics", icon: BarChart3 },
  { href: "/master/blog", label: "Blog", icon: Newspaper },
  { href: "/master/content", label: "Careers CMS", icon: ClipboardList },
];

const systemNavItems = [
  { href: "/master/logs", label: "Logs", icon: FileText },
  { href: "/master/support", label: "Support", icon: LifeBuoy },
  { href: "/master/data-deletion-requests", label: "Data Deletion", icon: ShieldAlert },
  { href: "/master/security", label: "Security", icon: Shield },
  { href: "/master/system-settings", label: "System Settings", icon: Settings },
  { href: "/master/reports", label: "Reports", icon: FileBarChart },
  { href: "/master/profile", label: "Profile", icon: User },
];

export function MasterShell({ title, subtitle, children, topActions }: MasterShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/master/auth/logout", { method: "POST" });
    router.push("/master-login");
  }

  function renderNavItem(item: (typeof platformNavItems)[number]) {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`admin-nav-item flex items-center gap-3 px-3 py-2.5 text-sm font-semibold no-underline ${
          active
            ? "admin-nav-item-active"
            : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
        }`}
      >
        <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span className="flex-1">{item.label}</span>
      </Link>
    );
  }

  return (
    <div className="admin-shell master-shell relative flex min-h-screen flex-col lg:flex-row">
      <aside className="admin-sidebar z-30 flex w-full flex-col overflow-y-auto border-b p-5 lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:w-[17rem] lg:border-b-0 lg:border-r">
        <div className="mb-6 px-1">
          <AdminPortalLogo subtitle="Master Control · Superadmin" />
        </div>

        <nav className="flex flex-1 flex-col gap-5">
          <div>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Platform
            </p>
            <div className="flex flex-col gap-0.5">{platformNavItems.map(renderNavItem)}</div>
          </div>

          <div>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              System
            </p>
            <div className="flex flex-col gap-0.5">{systemNavItems.map(renderNavItem)}</div>
          </div>
        </nav>

        <Link href="/master/reports" className="admin-btn-primary mb-3 mt-4 w-full py-3 no-underline">
          <FileBarChart className="h-4 w-4" aria-hidden="true" />
          Generate Report
        </Link>

        <div className="mt-auto space-y-3 border-t border-white/10 pt-5">
          <Link
            href="/master/help-center"
            className="mb-1 block py-1 text-center text-sm font-medium text-slate-400 no-underline transition hover:text-slate-200"
          >
            Help Center
          </Link>
          <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10 backdrop-blur-sm">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground"
              style={{ background: "var(--gradient-brand)" }}
              aria-hidden
            >
              M
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">Master Admin</p>
              <p className="text-[11px] text-slate-400">Platform superadmin</p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:ml-[17rem]">
        <header className="admin-header sticky top-0 z-20 border-b px-5 sm:px-10">
          <div className="flex h-[4.25rem] items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display truncate text-2xl font-extrabold tracking-tight text-foreground">
                {title}
              </h1>
              <p className="truncate text-xs font-medium text-muted-foreground">{subtitle}</p>
            </div>
            <MasterHeaderControls onLogout={logout} middleActions={topActions} />
          </div>
          <div className="pb-4 lg:hidden">
            <MasterGlobalSearch />
          </div>
        </header>

        <div className="mx-auto w-full max-w-[76rem] flex-1 space-y-6 p-5 sm:p-8">
          <div className="hidden lg:block">
            <MasterGlobalSearch />
          </div>
          {children}
        </div>

        <footer className="admin-footer mt-auto border-t py-8">
          <div className="mx-auto flex max-w-[76rem] flex-col items-center justify-between gap-4 px-8 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground md:flex-row">
            <span>© 2026 UHIRED. All rights reserved.</span>
            <div className="flex flex-wrap justify-center gap-6">
              <a href="/privacy" className="no-underline transition-colors hover:text-foreground">
                Privacy Policy
              </a>
              <a href="/terms" className="no-underline transition-colors hover:text-foreground">
                Terms of Service
              </a>
              <Link
                href="/master/security"
                className="font-bold text-foreground no-underline hover:underline"
              >
                Security
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
