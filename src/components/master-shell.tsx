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
  Plus,
  BookOpen,
  LifeBuoy,
  LogOut,
  Newspaper,
  ScrollText,
  Settings,
  Shield,
  TicketPercent,
  User,
  UserCog,
} from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { MasterGlobalSearch } from "@/components/master-global-search";
import { MasterHeaderControls } from "@/components/master-header-controls";

type MasterShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  topActions?: React.ReactNode;
};

const platformNavItems = [
  { href: "/master/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/master/companies", label: "Companies", icon: Building2 },
  { href: "/master/company-sessions", label: "Company interviews", icon: Briefcase },
  { href: "/master/interview-analytics", label: "Interview analytics", icon: BarChart3 },
  { href: "/master/practice-sessions", label: "Practice interviews", icon: ScrollText },
  { href: "/master/stuck-sessions", label: "Stuck interviews", icon: AlertTriangle },
  { href: "/master/data-deletion-requests", label: "Data deletion", icon: Shield },
  { href: "/master/payments", label: "Payments", icon: CreditCard },
  { href: "/master/promo-codes", label: "Promo codes", icon: TicketPercent },
  { href: "/master/user-analytics", label: "User analytics", icon: BarChart3 },
  { href: "/master/blog", label: "Blog", icon: Newspaper },
  { href: "/master/content", label: "Careers", icon: ClipboardList },
];

const systemNavItems = [
  { href: "/master/admins", label: "Master admins", icon: UserCog },
  { href: "/master/logs", label: "Logs", icon: FileText },
  { href: "/master/support", label: "Support", icon: LifeBuoy },
  { href: "/master/security", label: "Security", icon: Shield },
  { href: "/master/system-settings", label: "Settings", icon: Settings },
  { href: "/master/reports", label: "Reports", icon: FileBarChart },
  { href: "/master/help-center", label: "Help", icon: BookOpen },
  { href: "/master/profile", label: "Profile", icon: User },
];

export function MasterShell({ title, subtitle, children, topActions }: MasterShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/master/auth/logout", { method: "POST" });
    router.push("/master-login");
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <AppShell
      className="master-shell"
      brandTitle="Uhired"
      brandSubtitle="Master Control"
      headerTitle={title}
      headerSubtitle={subtitle}
      headerSearch={<MasterGlobalSearch />}
      headerActions={<MasterHeaderControls onLogout={logout} middleActions={topActions} />}
      primaryAction={{
        label: "Add company",
        href: "/master/companies/new",
        icon: Plus,
      }}
      secondaryAction={{
        label: "Support",
        href: "/master/support",
        icon: LifeBuoy,
      }}
      navGroups={[
        {
          items: platformNavItems.map((item) => ({
            key: item.href,
            label: item.label,
            icon: item.icon,
            href: item.href,
            active: isActive(item.href),
          })),
        },
        {
          label: "Operations",
          items: systemNavItems.map((item) => ({
            key: item.href,
            label: item.label,
            icon: item.icon,
            href: item.href,
            active: isActive(item.href),
          })),
        },
      ]}
      sidebarFooter={
        <div className="flex items-center gap-2 rounded-lg px-2 py-2">
          <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
            M
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">Master Admin</p>
            <p className="text-muted-foreground truncate text-xs">Super admin</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="text-muted-foreground hover:bg-sidebar-accent hover:text-foreground rounded-md p-1.5"
            aria-label="Logout"
            title="Logout"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </div>
      }
      footer={
        <footer className="admin-footer mt-auto border-t py-4">
          <div className="text-muted-foreground mx-auto flex max-w-[100rem] flex-col items-center justify-between gap-3 px-4 text-xs sm:flex-row sm:px-6">
            <span>© 2026 UHIRED. All rights reserved.</span>
            <div className="flex flex-wrap justify-center gap-4">
              <a href="/privacy" className="hover:text-foreground no-underline">
                Privacy Policy
              </a>
              <a href="/terms" className="hover:text-foreground no-underline">
                Terms of Service
              </a>
              <Link href="/master/security" className="hover:text-foreground font-medium no-underline">
                Security
              </Link>
            </div>
          </div>
        </footer>
      }
    >
      {children}
    </AppShell>
  );
}
