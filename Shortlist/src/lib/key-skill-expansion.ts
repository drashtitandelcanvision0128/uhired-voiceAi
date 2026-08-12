/** Compound skill labels → concrete technologies for interview targeting. */
const COMPOUND_SKILL_EXPANSIONS: Array<{ pattern: RegExp; skills: string[] }> = [
  {
    pattern: /\bmern[\s-]*stack\b/i,
    skills: ["MongoDB", "Express.js", "React", "Node.js"],
  },
  {
    pattern: /\bmean[\s-]*stack\b/i,
    skills: ["MongoDB", "Express.js", "Angular", "Node.js"],
  },
  {
    pattern: /\blamp[\s-]*stack\b/i,
    skills: ["Linux", "Apache", "MySQL", "PHP"],
  },
  {
    pattern: /\bpern[\s-]*stack\b/i,
    skills: ["PostgreSQL", "Express.js", "React", "Node.js"],
  },
  {
    pattern: /\bfull[\s-]*stack\b/i,
    skills: ["Frontend Development", "Backend Development", "Databases", "REST APIs"],
  },
];

/**
 * Expands umbrella skill labels (e.g. "MERN Stack") into concrete technologies
 * so interview questions target the right competencies.
 */
export function expandKeySkills(keySkills: string[]): string[] {
  const expanded: string[] = [];

  for (const raw of keySkills) {
    const skill = raw.trim();
    if (!skill) continue;

    const match = COMPOUND_SKILL_EXPANSIONS.find(({ pattern }) => pattern.test(skill));
    if (match) {
      expanded.push(...match.skills);
      continue;
    }

    expanded.push(skill);
  }

  return [...new Set(expanded)];
}
