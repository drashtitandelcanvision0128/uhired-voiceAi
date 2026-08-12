import type { CompanyMemberRole, Prisma } from "@prisma/client";
import { normalizeCompanyDomain } from "@/lib/company-admin-auth";
import { bypassTenantRls } from "@/lib/prisma-tenant-scope";

type MemberDb = {
  companyMember: {
    findUnique: Prisma.TransactionClient["companyMember"]["findUnique"];
    findFirst: Prisma.TransactionClient["companyMember"]["findFirst"];
    create: Prisma.TransactionClient["companyMember"]["create"];
    update: Prisma.TransactionClient["companyMember"]["update"];
  };
};

export async function ensureCompanyAdminMemberInTx(
  tx: MemberDb,
  companyId: string,
  email: string,
  name?: string | null,
) {
  const normalized = email.trim().toLowerCase();
  const existing = await tx.companyMember.findUnique({
    where: { companyId_email: { companyId, email: normalized } },
  });
  if (existing) {
    if (existing.role !== "ADMIN" || !existing.isActive) {
      return tx.companyMember.update({
        where: { id: existing.id },
        data: { role: "ADMIN", isActive: true, name: name ?? existing.name },
      });
    }
    return existing;
  }
  return tx.companyMember.create({
    data: {
      companyId,
      email: normalized,
      name: name ?? null,
      role: "ADMIN",
      isActive: true,
    },
  });
}

export async function ensureCompanyAdminMember(
  companyId: string,
  email: string,
  name?: string | null,
) {
  return bypassTenantRls((tx) => ensureCompanyAdminMemberInTx(tx, companyId, email, name));
}

export async function findActiveMemberByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return bypassTenantRls(async (tx) => {
    return tx.companyMember.findFirst({
      where: { email: normalized, isActive: true, company: { isActive: true } },
      include: { company: true },
    });
  });
}

export async function findMemberForOidcLogin(
  email: string,
  ssoSubject: string,
  autoProvisionRole: CompanyMemberRole | null,
) {
  const normalized = email.trim().toLowerCase();
  const emailDomain = normalized.split("@")[1];
  if (!emailDomain) return null;

  return bypassTenantRls(async (tx) => {
    const bySubject = await tx.companyMember.findFirst({
      where: { ssoSubject, isActive: true, company: { isActive: true } },
      include: { company: true },
    });
    if (bySubject) return bySubject;

    const byEmail = await tx.companyMember.findFirst({
      where: { email: normalized, isActive: true, company: { isActive: true } },
      include: { company: true },
    });
    if (byEmail) {
      if (!byEmail.ssoSubject) {
        return tx.companyMember.update({
          where: { id: byEmail.id },
          data: { ssoSubject, lastLoginAt: new Date() },
          include: { company: true },
        });
      }
      return byEmail;
    }

    const company = await tx.company.findFirst({
      where: {
        isActive: true,
        OR: [
          { adminEmail: normalized },
          { domain: emailDomain },
        ],
      },
    });
    if (!company) return null;

    const domainMatches =
      normalizeCompanyDomain(company.domain) === emailDomain ||
      company.domain.toLowerCase() === emailDomain;

    if (company.adminEmail === normalized) {
      const adminMember = await ensureCompanyAdminMemberInTx(tx, company.id, normalized);
      return tx.companyMember.findUnique({
        where: { id: adminMember.id },
        include: { company: true },
      });
    }

    if (!domainMatches) return null;

    if (!autoProvisionRole) return null;

    return tx.companyMember.create({
      data: {
        companyId: company.id,
        email: normalized,
        role: autoProvisionRole,
        isActive: true,
        ssoSubject,
        lastLoginAt: new Date(),
      },
      include: { company: true },
    });
  });
}

export async function touchMemberLogin(memberId: string) {
  return bypassTenantRls(async (tx) => {
    return tx.companyMember.update({
      where: { id: memberId },
      data: { lastLoginAt: new Date() },
    });
  });
}
