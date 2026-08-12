export type SiteTheme = "light" | "dark";

export const SITE_THEME_KEY = "uhired-site-theme";

export const SITE_THEME_VERSION_KEY = "uhired-site-theme-v";

export const SITE_THEME_VERSION = "2";

export const DEFAULT_SITE_THEME: SiteTheme = "dark";

export const DASHBOARD_AUTO_REFRESH_MS = 30_000;

export function getThemeInitScript() {
  return `(function(){try{var KEY="${SITE_THEME_KEY}";var VER_KEY="${SITE_THEME_VERSION_KEY}";var VER="${SITE_THEME_VERSION}";if(localStorage.getItem(VER_KEY)!==VER){localStorage.setItem(KEY,"dark");localStorage.setItem(VER_KEY,VER);document.documentElement.classList.add("dark");return;}var t=localStorage.getItem(KEY);if(t==="light"){document.documentElement.classList.remove("dark");}else{document.documentElement.classList.add("dark");if(!t)localStorage.setItem(KEY,"dark");}}catch(e){document.documentElement.classList.add("dark");}})();`;
}

export function applySiteTheme(next: SiteTheme) {
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", next === "dark");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", next === "dark" ? "#050816" : "#f8fafc");
    }
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SITE_THEME_KEY, next);
  }
}

export function readStoredSiteTheme(): SiteTheme | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(SITE_THEME_KEY);
  return stored === "dark" || stored === "light" ? stored : null;
}
