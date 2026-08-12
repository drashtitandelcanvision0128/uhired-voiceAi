import type { PrismaClient } from "@prisma/client";

export type SupportInquirySource = "PUBLIC_CONTACT" | "COMPANY_ADMIN";
export type SupportInquiryStatus = "NEW" | "READ" | "REPLIED" | "ARCHIVED";

export type SupportInquiryRecord = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  source: SupportInquirySource;
  status: SupportInquiryStatus;
  clientIp: string | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateSupportInquiryInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
  source: SupportInquirySource;
  clientIp?: string | null;
};

type ListSupportInquiryOptions = {
  where?: {
    createdAt?: { gte?: Date };
    status?: SupportInquiryStatus;
    source?: SupportInquirySource;
    search?: string;
  };
  take?: number;
  skip?: number;
};

function hasSupportInquiryDelegate(
  client: PrismaClient,
): client is PrismaClient & {
  supportInquiry: {
    create: (args: unknown) => Promise<SupportInquiryRecord>;
    findMany: (args: unknown) => Promise<SupportInquiryRecord[]>;
    count: (args: unknown) => Promise<number>;
    update: (args: unknown) => Promise<SupportInquiryRecord>;
    groupBy: (args: unknown) => Promise<Array<{ status: SupportInquiryStatus; _count: { _all: number } }>>;
  };
} {
  return "supportInquiry" in client && Boolean((client as PrismaClient & { supportInquiry?: unknown }).supportInquiry);
}

function buildDelegateWhere(options: ListSupportInquiryOptions) {
  const where: Record<string, unknown> = {};
  if (options.where?.createdAt?.gte) where.createdAt = { gte: options.where.createdAt.gte };
  if (options.where?.status) where.status = options.where.status;
  if (options.where?.source) where.source = options.where.source;
  if (options.where?.search) {
    where.OR = [
      { name: { contains: options.where.search, mode: "insensitive" } },
      { email: { contains: options.where.search, mode: "insensitive" } },
      { subject: { contains: options.where.search, mode: "insensitive" } },
      { message: { contains: options.where.search, mode: "insensitive" } },
    ];
  }
  return where;
}

function matchesSearch(record: SupportInquiryRecord, search: string) {
  const query = search.toLowerCase();
  return [record.name, record.email, record.subject, record.message].some((value) =>
    value.toLowerCase().includes(query),
  );
}

async function listSupportInquiriesRaw(client: PrismaClient, options: ListSupportInquiryOptions) {
  const gte = options.where?.createdAt?.gte;
  const rows = gte
    ? await client.$queryRaw<SupportInquiryRecord[]>`
        SELECT *
        FROM "SupportInquiry"
        WHERE "createdAt" >= ${gte}
        ORDER BY "createdAt" DESC
      `
    : await client.$queryRaw<SupportInquiryRecord[]>`
        SELECT *
        FROM "SupportInquiry"
        ORDER BY "createdAt" DESC
      `;

  let filtered = rows;
  if (options.where?.status) {
    filtered = filtered.filter((row) => row.status === options.where?.status);
  }
  if (options.where?.source) {
    filtered = filtered.filter((row) => row.source === options.where?.source);
  }
  if (options.where?.search) {
    filtered = filtered.filter((row) => matchesSearch(row, options.where!.search!));
  }

  const skip = options.skip ?? 0;
  const take = options.take ?? filtered.length;
  return filtered.slice(skip, skip + take);
}

export async function createSupportInquiry(client: PrismaClient, input: CreateSupportInquiryInput) {
  if (hasSupportInquiryDelegate(client)) {
    return client.supportInquiry.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        subject: input.subject,
        message: input.message,
        source: input.source,
        clientIp: input.clientIp ?? null,
      },
    });
  }

  const id = crypto.randomUUID();
  const now = new Date();
  await client.$executeRaw`
    INSERT INTO "SupportInquiry" ("id", "name", "email", "subject", "message", "source", "status", "clientIp", "createdAt", "updatedAt")
    VALUES (${id}, ${input.name}, ${input.email.toLowerCase()}, ${input.subject}, ${input.message}, ${input.source}, 'NEW', ${input.clientIp ?? null}, ${now}, ${now})
  `;

  const rows = await client.$queryRaw<SupportInquiryRecord[]>`
    SELECT * FROM "SupportInquiry" WHERE "id" = ${id} LIMIT 1
  `;
  return rows[0]!;
}

export async function listSupportInquiries(client: PrismaClient, options: ListSupportInquiryOptions = {}) {
  if (hasSupportInquiryDelegate(client)) {
    return client.supportInquiry.findMany({
      where: buildDelegateWhere(options),
      orderBy: { createdAt: "desc" },
      take: options.take,
      skip: options.skip,
    });
  }

  return listSupportInquiriesRaw(client, options);
}

export async function countSupportInquiries(client: PrismaClient, options: ListSupportInquiryOptions = {}) {
  if (hasSupportInquiryDelegate(client)) {
    return client.supportInquiry.count({ where: buildDelegateWhere(options) });
  }

  const rows = await listSupportInquiriesRaw(client, { ...options, take: undefined, skip: 0 });
  return rows.length;
}

export async function groupSupportInquiriesByStatus(
  client: PrismaClient,
  createdAtGte?: Date | null,
) {
  if (hasSupportInquiryDelegate(client)) {
    return client.supportInquiry.groupBy({
      by: ["status"],
      where: createdAtGte ? { createdAt: { gte: createdAtGte } } : undefined,
      _count: { _all: true },
    });
  }

  const rows = createdAtGte
    ? await client.$queryRaw<SupportInquiryRecord[]>`
        SELECT * FROM "SupportInquiry" WHERE "createdAt" >= ${createdAtGte}
      `
    : await client.$queryRaw<SupportInquiryRecord[]>`
        SELECT * FROM "SupportInquiry"
      `;

  const counts = new Map<SupportInquiryStatus, number>();
  for (const row of rows) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([status, count]) => ({
    status,
    _count: { _all: count },
  }));
}

export async function updateSupportInquiryStatus(
  client: PrismaClient,
  inquiryId: string,
  status: SupportInquiryStatus,
) {
  if (hasSupportInquiryDelegate(client)) {
    return client.supportInquiry.update({
      where: { id: inquiryId },
      data: {
        status,
        readAt: status === "READ" || status === "REPLIED" ? new Date() : undefined,
      },
    });
  }

  const readAt = status === "READ" || status === "REPLIED" ? new Date() : null;
  const now = new Date();
  await client.$executeRaw`
    UPDATE "SupportInquiry"
    SET "status" = ${status},
        "readAt" = COALESCE(${readAt}, "readAt"),
        "updatedAt" = ${now}
    WHERE "id" = ${inquiryId}
  `;

  const rows = await client.$queryRaw<SupportInquiryRecord[]>`
    SELECT * FROM "SupportInquiry" WHERE "id" = ${inquiryId} LIMIT 1
  `;
  return rows[0]!;
}

export async function countSupportInquiriesBySource(client: PrismaClient, source: SupportInquirySource) {
  if (hasSupportInquiryDelegate(client)) {
    return client.supportInquiry.count({ where: { source } });
  }

  const rows = await client.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS "count" FROM "SupportInquiry" WHERE "source" = ${source}
  `;
  return rows[0]?.count ?? 0;
}

export async function countSupportInquiriesByStatus(client: PrismaClient, status: SupportInquiryStatus) {
  if (hasSupportInquiryDelegate(client)) {
    return client.supportInquiry.count({ where: { status } });
  }

  const rows = await client.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS "count" FROM "SupportInquiry" WHERE "status" = ${status}
  `;
  return rows[0]?.count ?? 0;
}

export async function deleteSupportInquiry(client: PrismaClient, inquiryId: string) {
  if (hasSupportInquiryDelegate(client)) {
    try {
      await client.supportInquiry.delete({ where: { id: inquiryId } });
      return true;
    } catch {
      return false;
    }
  }

  const result = await client.$executeRaw`
    DELETE FROM "SupportInquiry" WHERE "id" = ${inquiryId}
  `;
  return Number(result) > 0;
}
