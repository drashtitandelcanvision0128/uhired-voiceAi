"use client";

import { useEffect, useState } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { useSiteTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { ButtonLink } from "./shared";

const links = [
  { label: "Platform", href: "/platform" },
  { label: "AI Interviews", href: "/ai-interviews" },
  { label: "Features", href: "/features" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "For Recruiters", href: "/for-recruiters" },
  { label: "For Candidates", href: "/for-candidates" },
  { label: "Security", href: "/security" },
  { label: "Contact", href: "/contact" },
];

export function Logo({ className }: { className?: string }) {
  return (
    <BrandLogo className={className} variant="theme" markSize={32} priority />
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ThemeSwitch() {
  const { theme, setTheme } = useSiteTheme();

  return (
    <div
      className="flex items-center rounded-xl border border-border bg-surface/60 p-0.5 shadow-sm"
      role="group"
      aria-label="Theme"
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={cn(
          "rounded-lg p-2 transition",
          theme === "light"
            ? "bg-surface-2 text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-label="Light theme"
        aria-pressed={theme === "light"}
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={cn(
          "rounded-lg p-2 transition",
          theme === "dark"
            ? "bg-surface-2 text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-label="Dark theme"
        aria-pressed={theme === "dark"}
      >
        <Moon className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky inset-x-0 top-0 z-50 transition-colors duration-300",
        solid ? "glass border-b" : "border-b border-transparent",
      )}
    >
      <nav
        aria-label="Main"
        className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3 sm:px-8"
      >
        <div className="flex min-w-0 items-center gap-8">
          <Logo />
          <ul className="hidden min-w-0 items-center gap-5 xl:flex">
            {links.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className={cn(
                      "text-sm whitespace-nowrap transition-colors no-underline",
                      active ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeSwitch />
          <Link
            href="/company-login"
            className="hidden px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground no-underline sm:block"
          >
            Sign In
          </Link>
          <ButtonLink to="/company-register" className="hidden px-4 py-2.5 sm:inline-flex">
            Get Started
          </ButtonLink>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface/60 xl:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>
      {open ? (
        <div className="glass border-t xl:hidden">
          <ul className="mx-auto grid max-w-7xl gap-1 px-5 py-4 sm:px-8">
            {links.map((l) => {
              const active = isActive(pathname, l.href);
              return (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "block rounded-lg px-3 py-2.5 text-sm no-underline",
                      active
                        ? "bg-surface-2 text-foreground font-medium"
                        : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
            <li className="mt-2 grid grid-cols-2 gap-2">
              <Link
                href="/company-login"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-border px-4 py-2.5 text-center text-sm font-semibold no-underline"
              >
                Sign In
              </Link>
              <ButtonLink to="/company-register" className="w-full">
                Get Started
              </ButtonLink>
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  );
}
