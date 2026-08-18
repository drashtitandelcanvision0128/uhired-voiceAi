import type { PrismaClient } from "@prisma/client";

export type MasterLoginEventRecord = {
  id: string;
  email: string;
  success: boolean;
  clientIp: string | null;
  userAgent: string | null;
  trustDevice: boolean;
  createdAt: Date;
};

type CreateMasterLoginEventInput = {
  email: string;
  success: boolean;
  clientIp?: string | null;
  userAgent?: string | null;
  trustDevice?: boolean;
};

function hasMasterLoginEventDelegate(
  client: PrismaClient,
): client is PrismaClient & {
  masterLoginEvent: {
    create: (args: unknown) => Promise<MasterLoginEventRecord>;
    findFirst: (args: unknown) => Promise<MasterLoginEventRecord | null>;
    findMany: (args: unknown) => Promise<MasterLoginEventRecord[]>;
    count: (args: unknown) => Promise<number>;
  };
} {
  return "masterLoginEvent" in client && Boolean((client as PrismaClient & { masterLoginEvent?: unknown }).masterLoginEvent);
}

export async function recordMasterLoginEvent(client: PrismaClient, input: CreateMasterLoginEventInput) {
  if (hasMasterLoginEventDelegate(client)) {
    return client.masterLoginEvent.create({
      data: {
        email: input.email.toLowerCase(),
        success: input.success,
        clientIp: input.clientIp ?? null,
        userAgent: input.userAgent ?? null,
        trustDevice: input.trustDevice ?? false,
      },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date();
  await client.$executeRaw`
    INSERT INTO "MasterLoginEvent" ("id", "email", "success", "clientIp", "userAgent", "trustDevice", "createdAt")
    VALUES (${id}, ${input.email.toLowerCase()}, ${input.success}, ${input.clientIp ?? null}, ${input.userAgent ?? null}, ${input.trustDevice ?? false}, ${now})
  `;
}

export async function getLastSuccessfulMasterLogin(client: PrismaClient, email: string) {
  if (hasMasterLoginEventDelegate(client)) {
    return client.masterLoginEvent.findFirst({
      where: { email: email.toLowerCase(), success: true },
      orderBy: { createdAt: "desc" },
    });
  }

  const rows = await client.$queryRaw<MasterLoginEventRecord[]>`
    SELECT *
    FROM "MasterLoginEvent"
    WHERE "email" = ${email.toLowerCase()} AND "success" = true
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

type ListMasterLoginEventsOptions = {
  page?: number;
  pageSize?: number;
  success?: boolean;
  search?: string;
  trustDevice?: boolean;
};

export async function listMasterLoginEvents(
  client: PrismaClient,
  options: ListMasterLoginEventsOptions = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  if (hasMasterLoginEventDelegate(client)) {
    const where: {
      success?: boolean;
      trustDevice?: boolean;
      OR?: Array<Record<string, { contains: string; mode: "insensitive" }>>;
    } = {};
    if (options.success !== undefined) where.success = options.success;
    if (options.trustDevice !== undefined) where.trustDevice = options.trustDevice;
    const search = options.search?.trim();
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { clientIp: { contains: search, mode: "insensitive" } },
      ];
    }
    const [rows, total] = await Promise.all([
      client.masterLoginEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      client.masterLoginEvent.count({ where }),
    ]);
    return { rows, total };
  }

  const rows = options.success === undefined
    ? await client.$queryRaw<MasterLoginEventRecord[]>`
        SELECT * FROM "MasterLoginEvent" ORDER BY "createdAt" DESC LIMIT ${pageSize} OFFSET ${skip}
      `
    : await client.$queryRaw<MasterLoginEventRecord[]>`
        SELECT * FROM "MasterLoginEvent"
        WHERE "success" = ${options.success}
        ORDER BY "createdAt" DESC
        LIMIT ${pageSize} OFFSET ${skip}
      `;

  const countRows = options.success === undefined
    ? await client.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*)::int AS "count" FROM "MasterLoginEvent"`
    : await client.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS "count" FROM "MasterLoginEvent" WHERE "success" = ${options.success}
      `;

  return { rows, total: countRows[0]?.count ?? 0 };
}

export async function countRecentFailedMasterLogins(
  client: PrismaClient,
  email: string,
  since: Date,
) {
  if (hasMasterLoginEventDelegate(client)) {
    return client.masterLoginEvent.count({
      where: {
        email: email.toLowerCase(),
        success: false,
        createdAt: { gte: since },
      },
    });
  }

  const rows = await client.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS "count"
    FROM "MasterLoginEvent"
    WHERE "email" = ${email.toLowerCase()}
      AND "success" = false
      AND "createdAt" >= ${since}
  `;
  return rows[0]?.count ?? 0;
}
