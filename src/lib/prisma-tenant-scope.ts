import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type TenantClient = Prisma.TransactionClient;

/**
 * Runs queries with PostgreSQL RLS tenant scope (app.company_id).
 * Master / practice flows should use bypassTenantRls instead.
 */
export async function withCompanyTenantScope<T>(
  companyId: string,
  fn: (tx: TenantClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.company_id', ${companyId}, true)`;
    return fn(tx);
  });
}

/** Bypass RLS for master portal, migrations, and practice-only data paths. */
export async function bypassTenantRls<T>(fn: (tx: TenantClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
    return fn(tx);
  });
}

export type PrismaLike = PrismaClient | TenantClient;
