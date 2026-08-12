/**
 * Single source of truth for requirement/session key skills (Option A: persist in DB).
 * Interview AI, scoring, and PDF all read through resolveSessionKeySkills().
 */

export function parseKeySkillsJson(value: unknown): string[] {
  if (!value || !Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

type KeySkillsSource = { keySkills?: unknown } | null | undefined;

/** Session snapshot first, then linked requirement (saved from admin form). */
export function resolveSessionKeySkills(
  session: KeySkillsSource,
  requirement?: KeySkillsSource,
): string[] {
  const fromSession = parseKeySkillsJson(session?.keySkills);
  if (fromSession.length > 0) return fromSession;
  return parseKeySkillsJson(requirement?.keySkills);
}

/** For Prisma JSON columns — omit field when empty. */
export function keySkillsForDb(skills: string[]): string[] | undefined {
  const normalized = skills.map((s) => s.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized : undefined;
}
