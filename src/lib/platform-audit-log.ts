import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

export type LogLevel = "INFO" | "SUCCESS" | "WARNING" | "ERROR";
export type LogCategory = "SESSION" | "COMPANY" | "PAYMENT" | "INVITE" | "PROMO" | "SYSTEM" | "PRIVACY" | "SECURITY";

export const LOG_CATEGORY_OPTIONS: ReadonlyArray<{ value: LogCategory; label: string }> = [
  { value: "SESSION", label: "Sessions" },
  { value: "COMPANY", label: "Companies" },
  { value: "PAYMENT", label: "Payments" },
  { value: "INVITE", label: "Invites" },
  { value: "PROMO", label: "Promo codes" },
  { value: "PRIVACY", label: "Privacy" },
  { value: "SECURITY", label: "Security" },
  { value: "SYSTEM", label: "System" },
];

export type PlatformLogEntry = {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  title: string;
  message: string;
  actor: string;
  metadata: Record<string, string>;
};

type AuditRow = {
  id: string;
  level: string;
  category: string;
  title: string;
  message: string;
  actor: string;
  metadata: unknown;
  createdAt: Date;
};

type AuditDelegate = {
  count: (args?: unknown) => Promise<number>;
  create: (args: unknown) => Promise<unknown>;
  createMany: (args: unknown) => Promise<unknown>;
  findMany: (args: unknown) => Promise<AuditRow[]>;
};

function getAuditDelegate(prisma: PrismaClient): AuditDelegate | null {
  const delegate = (prisma as unknown as { platformAuditLog?: AuditDelegate }).platformAuditLog;
  if (!delegate || typeof delegate.findMany !== "function") {
    return null;
  }
  return delegate;
}

function metadataToRecord(metadata: unknown): Record<string, string> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(metadata as Record<string, unknown>).map(([key, value]) => [key, String(value)]),
  );
}

function rowToEntry(row: AuditRow): PlatformLogEntry {
  return {
    id: row.id,
    timestamp: row.createdAt.toISOString(),
    level: row.level as LogLevel,
    category: row.category as LogCategory,
    title: row.title,
    message: row.message,
    actor: row.actor,
    metadata: metadataToRecord(row.metadata),
  };
}

async function rawCount(prisma: PrismaClient) {
  const result = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "PlatformAuditLog"`;
  return Number(result[0]?.count ?? 0);
}

async function rawInsert(
  prisma: PrismaClient,
  entry: {
    level: LogLevel;
    category: LogCategory;
    title: string;
    message: string;
    actor: string;
    metadata?: Record<string, string>;
    createdAt?: Date;
  },
) {
  const id = randomUUID();
  const createdAt = entry.createdAt ?? new Date();
  await prisma.$executeRaw`
    INSERT INTO "PlatformAuditLog" ("id", "level", "category", "title", "message", "actor", "metadata", "createdAt")
    VALUES (
      ${id},
      ${entry.level},
      ${entry.category},
      ${entry.title},
      ${entry.message},
      ${entry.actor},
      ${JSON.stringify(entry.metadata ?? {})}::jsonb,
      ${createdAt}
    )
  `;
  return { id };
}

async function rawList(
  prisma: PrismaClient,
  options: {
    page: number;
    pageSize: number;
    category?: LogCategory | "";
    level?: LogLevel | "";
    search?: string;
  },
) {
  const search = options.search?.trim() ?? "";
  const offset = (options.page - 1) * options.pageSize;

  const rows = await prisma.$queryRaw<AuditRow[]>`
    SELECT "id", "level", "category", "title", "message", "actor", "metadata", "createdAt"
    FROM "PlatformAuditLog"
    WHERE
      (${options.category ?? ""} = '' OR "category" = ${options.category ?? ""})
      AND (${options.level ?? ""} = '' OR "level" = ${options.level ?? ""})
      AND (
        ${search} = ''
        OR LOWER("title") LIKE '%' || LOWER(${search}) || '%'
        OR LOWER("message") LIKE '%' || LOWER(${search}) || '%'
        OR LOWER("actor") LIKE '%' || LOWER(${search}) || '%'
        OR LOWER("category") LIKE '%' || LOWER(${search}) || '%'
      )
    ORDER BY "createdAt" DESC
    LIMIT ${options.pageSize}
    OFFSET ${offset}
  `;

  const totalRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "PlatformAuditLog"
    WHERE
      (${options.category ?? ""} = '' OR "category" = ${options.category ?? ""})
      AND (${options.level ?? ""} = '' OR "level" = ${options.level ?? ""})
      AND (
        ${search} = ''
        OR LOWER("title") LIKE '%' || LOWER(${search}) || '%'
        OR LOWER("message") LIKE '%' || LOWER(${search}) || '%'
        OR LOWER("actor") LIKE '%' || LOWER(${search}) || '%'
        OR LOWER("category") LIKE '%' || LOWER(${search}) || '%'
      )
  `;

  const allForCounts = await prisma.$queryRaw<Array<{ category: string; level: string }>>`
    SELECT "category", "level"
    FROM "PlatformAuditLog"
    ORDER BY "createdAt" DESC
    LIMIT 5000
  `;

  const categoryCounts = {} as Record<LogCategory, number>;
  const levelCounts = {} as Record<LogLevel, number>;
  for (const row of allForCounts) {
    categoryCounts[row.category as LogCategory] = (categoryCounts[row.category as LogCategory] ?? 0) + 1;
    levelCounts[row.level as LogLevel] = (levelCounts[row.level as LogLevel] ?? 0) + 1;
  }

  return {
    rows: rows.map(rowToEntry),
    total: Number(totalRows[0]?.count ?? 0),
    categoryCounts,
    levelCounts,
  };
}

export async function writePlatformAuditLog(
  prisma: PrismaClient,
  entry: {
    level: LogLevel;
    category: LogCategory;
    title: string;
    message: string;
    actor?: string;
    metadata?: Record<string, string>;
  },
) {
  const data = {
    level: entry.level,
    category: entry.category,
    title: entry.title,
    message: entry.message,
    actor: entry.actor ?? "Master admin",
    metadata: entry.metadata ?? {},
  };

  const delegate = getAuditDelegate(prisma);
  if (delegate) {
    try {
      return await delegate.create({ data });
    } catch {
      // fall through to raw SQL
    }
  }

  try {
    return await rawInsert(prisma, data);
  } catch {
    return null;
  }
}

export async function listPlatformAuditLogs(
  prisma: PrismaClient,
  options: {
    page: number;
    pageSize: number;
    category?: LogCategory | "";
    level?: LogLevel | "";
    search?: string;
  },
) {
  const delegate = getAuditDelegate(prisma);
  if (!delegate) {
    try {
      return await rawList(prisma, options);
    } catch {
      return {
        rows: [] as PlatformLogEntry[],
        total: 0,
        categoryCounts: {} as Record<LogCategory, number>,
        levelCounts: {} as Record<LogLevel, number>,
      };
    }
  }

  const search = options.search?.trim().toLowerCase() ?? "";
  const where = {
    ...(options.category ? { category: options.category } : {}),
    ...(options.level ? { level: options.level } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { message: { contains: search, mode: "insensitive" as const } },
            { actor: { contains: search, mode: "insensitive" as const } },
            { category: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total, allForCounts] = await Promise.all([
    delegate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (options.page - 1) * options.pageSize,
      take: options.pageSize,
    }),
    delegate.count({ where }),
    delegate.findMany({
      select: { category: true, level: true },
      take: 5000,
      orderBy: { createdAt: "desc" },
    } as unknown as { select: { category: true; level: true }; take: number; orderBy: { createdAt: "desc" } }),
  ]);

  const categoryCounts = {} as Record<LogCategory, number>;
  const levelCounts = {} as Record<LogLevel, number>;
  for (const row of allForCounts as Array<{ category: string; level: string }>) {
    categoryCounts[row.category as LogCategory] = (categoryCounts[row.category as LogCategory] ?? 0) + 1;
    levelCounts[row.level as LogLevel] = (levelCounts[row.level as LogLevel] ?? 0) + 1;
  }

  return {
    rows: rows.map(rowToEntry),
    total,
    categoryCounts,
    levelCounts,
  };
}

export async function seedPlatformAuditLogsIfEmpty(prisma: PrismaClient) {
  let existing = 0;
  const delegate = getAuditDelegate(prisma);
  if (delegate) {
    existing = await delegate.count();
  } else {
    try {
      existing = await rawCount(prisma);
    } catch {
      return;
    }
  }
  if (existing > 0) return;

  const [sessions, companies, payments, promoCodes, invites] = await Promise.all([
    prisma.interviewSession.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        sessionType: true,
        status: true,
        candidateName: true,
        candidateEmail: true,
        companyName: true,
        domain: true,
        durationMin: true,
        createdAt: true,
      },
    }),
    prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, name: true, adminEmail: true, isActive: true, createdAt: true },
    }),
    prisma.practicePayment.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        orderId: true,
        status: true,
        amountPaise: true,
        candidateEmail: true,
        candidateName: true,
        createdAt: true,
      },
    }),
    prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { code: true, durationMin: true, isActive: true, createdAt: true },
    }),
    prisma.requirementInvite.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        email: true,
        createdAt: true,
        company: { select: { name: true } },
      },
    }),
  ]);

  const entries: Array<{
    level: LogLevel;
    category: LogCategory;
    title: string;
    message: string;
    actor: string;
    metadata: Record<string, string>;
    createdAt: Date;
  }> = [];

  for (const session of sessions) {
    const actor = session.candidateEmail ?? session.candidateName ?? "Unknown";
    const isPractice = session.sessionType === "PRACTICE";
    entries.push({
      createdAt: session.createdAt,
      level: "INFO",
      category: "SESSION",
      title: isPractice ? "Practice session created" : "Company interview session created",
      message: isPractice
        ? `${session.candidateName ?? "Candidate"} started a ${session.durationMin}m practice session in ${session.domain}.`
        : `${session.candidateName ?? "Candidate"} joined ${session.companyName ?? "a company"} interview (${session.domain}).`,
      actor,
      metadata: { sessionId: session.id, status: session.status, type: session.sessionType },
    });
  }

  for (const company of companies) {
    entries.push({
      createdAt: company.createdAt,
      level: "SUCCESS",
      category: "COMPANY",
      title: "Company onboarded",
      message: `${company.name} was added to the platform (admin: ${company.adminEmail}).`,
      actor: company.adminEmail,
      metadata: { companyId: company.id, companyName: company.name },
    });
  }

  for (const payment of payments) {
    entries.push({
      createdAt: payment.createdAt,
      level: payment.status === "VERIFIED" ? "SUCCESS" : payment.status === "FAILED" ? "ERROR" : "INFO",
      category: "PAYMENT",
      title: "Practice payment recorded",
      message: `${payment.candidateName} — ₹${(payment.amountPaise / 100).toFixed(0)} (${payment.status.toLowerCase()}).`,
      actor: payment.candidateEmail,
      metadata: { orderId: payment.orderId, status: payment.status },
    });
  }

  for (const promo of promoCodes) {
    entries.push({
      createdAt: promo.createdAt,
      level: "INFO",
      category: "PROMO",
      title: "Promo code created",
      message: `Code ${promo.code} created for ${promo.durationMin}-minute sessions.`,
      actor: "Master admin",
      metadata: { promoCode: promo.code },
    });
  }

  for (const invite of invites) {
    entries.push({
      createdAt: invite.createdAt,
      level: "INFO",
      category: "INVITE",
      title: "Candidate invite created",
      message: `${invite.email} was invited by ${invite.company.name}.`,
      actor: invite.email,
      metadata: { inviteId: invite.id },
    });
  }

  for (const entry of entries) {
    if (delegate) {
      try {
        await delegate.create({
          data: {
            level: entry.level,
            category: entry.category,
            title: entry.title,
            message: entry.message,
            actor: entry.actor,
            metadata: entry.metadata,
            createdAt: entry.createdAt,
          },
        });
      } catch {
        await rawInsert(prisma, entry);
      }
    } else {
      await rawInsert(prisma, entry);
    }
  }
}
