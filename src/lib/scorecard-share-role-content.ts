import type { ScorecardSharePublicPayload } from "@/lib/scorecard-share-payload";
import { ROLE_CATALOG, type RoleCatalogEntry } from "@/lib/scorecard-role-catalog-data";

export type PdfSkillRow = { name: string; rating: number; score0to100: number };

const UNIVERSAL_COMMUNICATION =
  /communication|presentation|articulation|stakeholder|empathy|collaboration|interpersonal|client|customer|bedside|teamwork|documentation/i;
const UNIVERSAL_REASONING =
  /problem|reasoning|analytical|critical|judgment|judgement|decision|logic|assessment|diagnostic|troubleshoot|safety/i;
const UNIVERSAL_DOMAIN =
  /domain|technical|core|fundamentals|knowledge|expertise|standards|compliance|clinical|engineering|design|policy|medical|structural|financial|legal|nursing|civil|software|coding|patient|care|treatment|analysis|planning|estimation|prototype|campaign|recruit|talent|brand|seo|analytics|autocad|figma|react|node|api|postgres|medication|diagnosis|ethics|professional|role|fit|alignment|culinary|aviation|audit|pharma|surgical|farm|retail|warehouse|hotel|pilot|chef|journal|photo|music|film|sport|fitness|coach|army|police|government|ias|ips|railway|judge|advocate|prosecut|horticulture|dairy|aircraft|cabin|logistics|ecommerce|freelance|virtual|youtube|content/i;

const GENERAL_ENTRY: RoleCatalogEntry = {
  id: "general",
  label: "Role-based Assessment",
  patterns: [],
  skills: [],
  matchKeywords: /.^/,
};

const STALE_TECH_SKILLS = /react|node\.?js|ui design|postgresql|api integration|typescript|javascript/i;

function roleHaystack(payload: ScorecardSharePublicPayload): string {
  return [payload.positionTitle, payload.domain, payload.topic].filter(Boolean).join(" ").toLowerCase();
}

function matchCatalogEntry(text: string): RoleCatalogEntry | null {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return null;
  for (const entry of ROLE_CATALOG) {
    if (entry.patterns.some((p) => p.test(normalized))) return entry;
  }
  return null;
}

function detectRoleEntry(payload: ScorecardSharePublicPayload): RoleCatalogEntry {
  const title = (payload.positionTitle ?? "").toLowerCase();
  const fromTitle = matchCatalogEntry(title);
  if (fromTitle) return fromTitle;

  const fromHaystack = matchCatalogEntry(roleHaystack(payload));
  if (fromHaystack) return fromHaystack;

  return GENERAL_ENTRY;
}

/** Build skills for roles not in catalog (e.g. "Architect", "Chef", "Pilot"). */
function buildDynamicSkillsForRole(payload: ScorecardSharePublicPayload): string[] {
  let role = getTargetRoleDisplay(payload);
  role = role.replace(/\b(interview|position|role|candidate)\b/gi, "").trim();
  if (!role) role = payload.domain || "Professional Role";

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

function catalogSkills(entry: RoleCatalogEntry, payload: ScorecardSharePublicPayload): string[] {
  if (entry.id === "general") return buildDynamicSkillsForRole(payload);
  return entry.skills.slice(0, 6);
}

function looksLikeStaleTechSkills(skills: string[]): boolean {
  const hits = skills.filter((s) => STALE_TECH_SKILLS.test(s.toLowerCase())).length;
  return hits >= 2;
}

export function detectInterviewRoleProfile(payload: ScorecardSharePublicPayload): string {
  return detectRoleEntry(payload).id;
}

export function getTargetRoleDisplay(payload: ScorecardSharePublicPayload): string {
  const title = payload.positionTitle?.trim();
  if (title) return title;
  return `${payload.domain} · ${payload.topic}`;
}

export function getRoleProfileLabel(payload: ScorecardSharePublicPayload): string {
  const entry = detectRoleEntry(payload);
  if (entry.id === "general") {
    const role = getTargetRoleDisplay(payload);
    return role.length > 40 ? `${role.slice(0, 37)}...` : role;
  }
  return entry.label;
}

function scoreToStars(score0to100: number): number {
  const stars = (score0to100 / 100) * 5;
  return Math.min(5, Math.max(1, Math.round(stars)));
}

function dimensionScoreForSkill(
  skillName: string,
  sc: ScorecardSharePublicPayload["scorecard"],
  index: number,
): number {
  const s = skillName.toLowerCase();

  if (UNIVERSAL_COMMUNICATION.test(s)) return sc.communication;
  if (UNIVERSAL_REASONING.test(s)) return sc.confidence;
  if (UNIVERSAL_DOMAIN.test(s)) return sc.domainDepth;

  const rotation = [sc.domainDepth, sc.communication, sc.confidence, sc.overallScore];
  return rotation[index % rotation.length] ?? sc.overallScore;
}

export function resolveSkillsForPdf(payload: ScorecardSharePublicPayload): string[] {
  const entry = detectRoleEntry(payload);
  const roleSkills = catalogSkills(entry, payload);
  const keySkills = (payload.keySkills ?? []).map((s) => s.trim()).filter(Boolean);

  if (!keySkills.length) return roleSkills;

  // Requirement / session key skills from the admin form always win in the PDF,
  // except when clearly stale default tech tags on a non-tech role.
  if (entry.id !== "general" && looksLikeStaleTechSkills(keySkills)) {
    return roleSkills;
  }

  return keySkills.slice(0, 6);
}

export function buildPdfSkillRows(payload: ScorecardSharePublicPayload): PdfSkillRow[] {
  const sc = payload.scorecard;
  const names = resolveSkillsForPdf(payload);
  return names.map((name, index) => {
    const score0to100 = dimensionScoreForSkill(name, sc, index);
    return {
      name,
      rating: scoreToStars(score0to100),
      score0to100,
    };
  });
}
