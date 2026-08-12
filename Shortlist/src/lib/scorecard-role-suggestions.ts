import { ROLE_CATALOG, type RoleCatalogEntry } from "@/lib/scorecard-role-catalog-data";

export type TargetRoleSkillSuggestion = {
  roleId: string;
  roleLabel: string;
  skills: string[];
};

const GENERAL_ENTRY: RoleCatalogEntry = {
  id: "general",
  label: "Role-based assessment",
  patterns: [],
  skills: [],
  matchKeywords: /.^/,
};

function matchCatalogEntry(text: string): RoleCatalogEntry | null {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return null;
  for (const entry of ROLE_CATALOG) {
    if (entry.patterns.some((p) => p.test(normalized))) return entry;
  }
  return null;
}

function dynamicSkillsForUnknownRole(targetRole: string): string[] {
  const role = targetRole.replace(/\b(interview|position|role|candidate)\b/gi, "").trim();
  if (!role) return [];
  const short = role.length > 28 ? `${role.slice(0, 25).trim()}...` : role;
  return [
    `${short} Fundamentals`,
    "Domain Expertise",
    "Problem Solving & Judgment",
    "Communication",
    "Professional Standards",
    "Role Alignment",
  ];
}

/** Suggest key skills for admin requirement form from target role text. */
export function suggestKeySkillsForTargetRole(targetRole: string): TargetRoleSkillSuggestion {
  const trimmed = targetRole.trim();
  if (!trimmed) {
    return { roleId: "general", roleLabel: "", skills: [] };
  }

  const entry = matchCatalogEntry(trimmed) ?? GENERAL_ENTRY;
  if (entry.id === "general") {
    return {
      roleId: "general",
      roleLabel: trimmed,
      skills: dynamicSkillsForUnknownRole(trimmed),
    };
  }

  return {
    roleId: entry.id,
    roleLabel: entry.label,
    skills: entry.skills.slice(0, 8),
  };
}
