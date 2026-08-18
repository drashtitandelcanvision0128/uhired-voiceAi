export const ADMIN_SECTION_SLUGS = [
  "dashboard",
  "invite",
  "candidates",
  "opening",
  "sessions",
  "ai-interviewer",
  "settings",
  "support",
  "profile",
] as const;

export type AdminSectionSlug = (typeof ADMIN_SECTION_SLUGS)[number];

export type AdminOpeningTab = "openings" | "sessions";

export type AdminPortalRoute = {
  section: string;
  openingTab: AdminOpeningTab;
  slug: AdminSectionSlug;
};

const SLUG_ALIASES: Record<string, AdminSectionSlug> = {
  dashboard: "dashboard",
  invite: "invite",
  invites: "invite",
  overview: "invite",
  candidates: "candidates",
  opening: "opening",
  openings: "opening",
  requirements: "opening",
  sessions: "sessions",
  "ai-interviewer": "ai-interviewer",
  interviewer: "ai-interviewer",
  settings: "settings",
  "app-settings": "settings",
  support: "support",
  profile: "profile",
};

export function isAdminSectionSlug(value: string): value is AdminSectionSlug {
  return (ADMIN_SECTION_SLUGS as readonly string[]).includes(value);
}

export function parseAdminPath(pathname: string): AdminPortalRoute {
  const raw = pathname.replace(/^\/admin\/?/, "").split("/")[0]?.trim() || "dashboard";
  const slug = SLUG_ALIASES[raw] ?? "dashboard";

  if (slug === "invite") return { section: "overview", openingTab: "openings", slug };
  if (slug === "opening") return { section: "requirements", openingTab: "openings", slug };
  if (slug === "sessions") return { section: "requirements", openingTab: "sessions", slug };
  if (slug === "ai-interviewer") return { section: "settings", openingTab: "openings", slug };
  if (slug === "settings") return { section: "app-settings", openingTab: "openings", slug };
  if (slug === "support") return { section: "support", openingTab: "openings", slug };
  if (slug === "profile") return { section: "profile", openingTab: "openings", slug };
  if (slug === "candidates") return { section: "candidates", openingTab: "openings", slug };
  return { section: "dashboard", openingTab: "openings", slug: "dashboard" };
}

export function adminPathForSection(section: string, openingTab: AdminOpeningTab = "openings"): string {
  if (section === "overview") return "/admin/invite";
  if (section === "candidates") return "/admin/candidates";
  if (section === "sessions" || (section === "requirements" && openingTab === "sessions")) {
    return "/admin/sessions";
  }
  if (section === "requirements") return "/admin/opening";
  if (section === "settings") return "/admin/ai-interviewer";
  if (section === "app-settings") return "/admin/settings";
  if (section === "support") return "/admin/support";
  if (section === "profile") return "/admin/profile";
  return "/admin/dashboard";
}

export function adminNavHref(navKey: string): string {
  return adminPathForSection(navKey);
}
