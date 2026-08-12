import type { CompanyMemberRole } from "@prisma/client";

export type CompanyPermission =
  | "sessions:read"
  | "sessions:write"
  | "requirements:read"
  | "requirements:write"
  | "candidates:read"
  | "candidates:write"
  | "settings:read"
  | "settings:write"
  | "team:manage"
  | "invite:send";

const ROLE_PERMISSIONS: Record<CompanyMemberRole, ReadonlySet<CompanyPermission>> = {
  ADMIN: new Set([
    "sessions:read",
    "sessions:write",
    "requirements:read",
    "requirements:write",
    "candidates:read",
    "candidates:write",
    "settings:read",
    "settings:write",
    "team:manage",
    "invite:send",
  ]),
  HIRING_MANAGER: new Set([
    "sessions:read",
    "sessions:write",
    "requirements:read",
    "requirements:write",
    "candidates:read",
    "candidates:write",
    "settings:read",
    "invite:send",
  ]),
  RECRUITER: new Set([
    "sessions:read",
    "sessions:write",
    "candidates:read",
    "candidates:write",
    "requirements:read",
    "invite:send",
  ]),
  VIEWER: new Set([
    "sessions:read",
    "candidates:read",
    "requirements:read",
  ]),
};

export const COMPANY_MEMBER_ROLES: CompanyMemberRole[] = [
  "ADMIN",
  "RECRUITER",
  "HIRING_MANAGER",
  "VIEWER",
];

export function normalizeMemberRole(role: string): CompanyMemberRole | null {
  const upper = role.trim().toUpperCase();
  if (COMPANY_MEMBER_ROLES.includes(upper as CompanyMemberRole)) {
    return upper as CompanyMemberRole;
  }
  return null;
}

export function hasCompanyPermission(role: CompanyMemberRole, permission: CompanyPermission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function roleLabel(role: CompanyMemberRole): string {
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "RECRUITER":
      return "Recruiter";
    case "HIRING_MANAGER":
      return "Hiring Manager";
    case "VIEWER":
      return "Viewer";
    default:
      return role;
  }
}

export class CompanyPermissionError extends Error {
  readonly status = 403;

  constructor(permission: CompanyPermission) {
    super(`Missing permission: ${permission}`);
    this.name = "CompanyPermissionError";
  }
}

export function assertCompanyPermission(role: CompanyMemberRole, permission: CompanyPermission) {
  if (!hasCompanyPermission(role, permission)) {
    throw new CompanyPermissionError(permission);
  }
}
