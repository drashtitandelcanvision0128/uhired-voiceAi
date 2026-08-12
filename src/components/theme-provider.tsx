"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  applySiteTheme,
  DEFAULT_SITE_THEME,
  readStoredSiteTheme,
  type SiteTheme,
} from "@/lib/site-theme";

type ThemeContextValue = {
  theme: SiteTheme;
  setTheme: (next: SiteTheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<SiteTheme>(DEFAULT_SITE_THEME);

  const setTheme = useCallback((next: SiteTheme) => {
    applySiteTheme(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  useEffect(() => {
    setTheme(readStoredSiteTheme() ?? DEFAULT_SITE_THEME);
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useSiteTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useSiteTheme must be used within ThemeProvider");
  }
  return ctx;
}
