"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Mail, PanelLeft, Plus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AdminPortalLogo } from "@/components/admin-portal-logo";
import { BrandLogoMark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AppShellNavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  count?: number | string;
};

export type AppShellNavGroup = {
  label?: string;
  items: AppShellNavItem[];
};

type AppShellProps = {
  brandTitle?: string;
  brandSubtitle?: string;
  navGroups: AppShellNavGroup[];
  primaryAction?: {
    label: string;
    icon?: LucideIcon;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    icon?: LucideIcon;
    href?: string;
    onClick?: () => void;
  };
  headerTitle: string;
  headerSubtitle?: ReactNode;
  headerSearch?: ReactNode;
  headerActions?: ReactNode;
  sidebarFooter?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
};

function NavItemView({
  item,
  onNavigate,
  compact = false,
}: {
  item: AppShellNavItem;
  onNavigate: () => void;
  compact?: boolean;
}) {
  const className = cn(
    "admin-nav-item flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
    compact && "justify-center px-2",
    item.active
      ? "admin-nav-item-active font-medium"
      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
  );

  const countValue = item.count == null ? 0 : Number(item.count);
  const showCount = item.count != null && item.count !== "" && countValue > 0;

  const content = (
    <>
      <item.icon
        className={cn("size-4 shrink-0", item.active && "text-primary")}
        strokeWidth={item.active ? 2.25 : 1.75}
        aria-hidden="true"
      />
      {!compact ? <span className="min-w-0 flex-1 truncate text-left">{item.label}</span> : null}
      {!compact && showCount ? (
        <span className={cn("admin-nav-count ml-auto", item.active && "admin-nav-count-active")}>
          {item.count}
        </span>
      ) : null}
    </>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(className, "no-underline")}
        aria-label={compact ? item.label : undefined}
        title={compact ? item.label : undefined}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        item.onClick?.();
        onNavigate();
      }}
      className={className}
      aria-label={compact ? item.label : undefined}
      title={compact ? item.label : undefined}
    >
      {content}
    </button>
  );
}

function ActionButton({
  action,
  variant,
  onNavigate,
}: {
  action: NonNullable<AppShellProps["primaryAction"]>;
  variant: "default" | "outline";
  onNavigate: () => void;
}) {
  const Icon = action.icon ?? (variant === "default" ? Plus : Mail);
  const className =
    variant === "default"
      ? "h-8 flex-1 rounded-lg"
      : "size-8 shrink-0 rounded-lg";

  if (action.href) {
    return (
      <Button asChild variant={variant} size={variant === "default" ? "sm" : "icon"} className={className}>
        <Link href={action.href} onClick={onNavigate} aria-label={action.label}>
          <Icon />
          {variant === "default" ? action.label : null}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={variant === "default" ? "sm" : "icon"}
      className={className}
      onClick={() => {
        action.onClick?.();
        onNavigate();
      }}
      aria-label={action.label}
    >
      <Icon />
      {variant === "default" ? action.label : null}
    </Button>
  );
}

export function AppShell({
  brandTitle = "Uhired",
  brandSubtitle,
  navGroups,
  primaryAction,
  secondaryAction,
  headerTitle,
  headerSubtitle,
  headerSearch,
  headerActions,
  sidebarFooter,
  footer,
  className,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  function closeMobile() {
    setMobileOpen(false);
  }

  function toggleSidebar() {
    setDesktopCollapsed((current) => !current);
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-2 p-2">
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5",
          desktopCollapsed ? "justify-center lg:flex-col" : "justify-between",
        )}
      >
        <div className={cn("min-w-0 flex-1", desktopCollapsed && "lg:flex-none")}>
          {desktopCollapsed ? (
            <>
              <div className="lg:hidden">
                <AdminPortalLogo subtitle={brandSubtitle} title={brandTitle} />
              </div>
              <div className="hidden lg:block">
                <span className="sr-only">{brandTitle}</span>
                <BrandLogoMark variant="theme" size={32} />
              </div>
            </>
          ) : (
            <AdminPortalLogo subtitle={brandSubtitle} title={brandTitle} />
          )}
        </div>
        <button
          type="button"
          className={cn(
            "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground hidden size-8 items-center justify-center rounded-lg lg:inline-flex",
            desktopCollapsed && "border border-border bg-background/80 shadow-sm",
          )}
          onClick={toggleSidebar}
          aria-label={desktopCollapsed ? "Open sidebar" : "Collapse sidebar"}
          title={desktopCollapsed ? "Open sidebar" : "Collapse sidebar"}
        >
          <PanelLeft className={cn("size-4 transition-transform", desktopCollapsed && "rotate-180")} />
        </button>
        <button
          type="button"
          className="text-muted-foreground hover:bg-sidebar-accent hover:text-foreground inline-flex size-8 items-center justify-center rounded-lg lg:hidden"
          onClick={closeMobile}
          aria-label="Close sidebar"
        >
          <X className="size-4" />
        </button>
      </div>

      {(primaryAction || secondaryAction) && (
        <div className={cn("flex items-center gap-2 px-1", desktopCollapsed && "lg:hidden")}>
          {primaryAction ? (
            <ActionButton action={primaryAction} variant="default" onNavigate={closeMobile} />
          ) : null}
          {secondaryAction ? (
            <ActionButton action={secondaryAction} variant="outline" onNavigate={closeMobile} />
          ) : null}
        </div>
      )}

      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-1">
        {navGroups.map((group, index) => (
          <div key={group.label ?? `group-${index}`}>
            {group.label && !desktopCollapsed ? (
              <p className="text-muted-foreground mb-1 px-2 text-xs font-medium">{group.label}</p>
            ) : null}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavItemView key={item.key} item={item} onNavigate={closeMobile} compact={desktopCollapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {sidebarFooter ? <div className={cn("mt-auto border-t pt-2", desktopCollapsed && "lg:hidden")}>{sidebarFooter}</div> : null}
    </div>
  );

  return (
    <div className={cn("admin-shell relative flex min-h-svh w-full", className)}>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Close menu"
          onClick={closeMobile}
        />
      ) : null}

      <aside
        className={cn(
          "admin-sidebar fixed inset-y-0 left-0 z-50 border-r transition-[width,transform] duration-200 ease-out",
          "w-64",
          desktopCollapsed ? "lg:w-16" : "lg:w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {sidebar}
      </aside>

      <div className={cn("flex min-w-0 flex-1 flex-col transition-[padding] duration-200", desktopCollapsed ? "lg:pl-16" : "lg:pl-64")}>
        <header className="admin-header sticky top-0 z-40 flex h-12 items-center gap-2 border-b px-3 sm:px-4">
          <button
            type="button"
            className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-lg lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle sidebar"
          >
            <PanelLeft className="size-4" />
          </button>
          <div className="bg-border mx-1 hidden h-4 w-px sm:block lg:hidden" />
          <div className="min-w-0 max-w-[46%] shrink">
            <h1 className="truncate text-sm font-medium">{headerTitle}</h1>
            {headerSubtitle ? (
              <p className="text-muted-foreground hidden truncate text-xs sm:block">{headerSubtitle}</p>
            ) : null}
          </div>
          {headerSearch ? <div className="hidden min-w-0 flex-1 md:block">{headerSearch}</div> : null}
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">{headerActions}</div>
        </header>

        {headerSearch ? <div className="border-b px-3 py-2 md:hidden">{headerSearch}</div> : null}

        <main className="mx-auto w-full max-w-[100rem] flex-1 space-y-4 p-3 sm:space-y-6 sm:p-4 lg:p-6">
          {children}
        </main>

        {footer}
      </div>
    </div>
  );
}
