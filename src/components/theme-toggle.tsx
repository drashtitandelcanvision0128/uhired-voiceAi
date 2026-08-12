"use client";

import { Moon, Sun } from "lucide-react";
import { useSiteTheme } from "@/components/theme-provider";

type ThemeToggleProps = {
  className?: string;
  size?: "sm" | "md";
};

export function ThemeToggle({ className = "", size = "md" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useSiteTheme();
  const dim = size === "sm" ? "h-9 w-9" : "h-10 w-10";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex ${dim} items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted ${className}`}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
