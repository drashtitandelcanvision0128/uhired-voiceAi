import type { Prisma, PrismaClient } from "@prisma/client";
import { deleteInterviewVideoAssets } from "@/lib/interview-video-storage";
import { writePlatformAuditLog } from "@/lib/platform-audit-log";

export const STUCK_SESSION_AGE_MS = 60 * 60 * 1000;

const STUCK_STATUSES = ["LIVE", "READY"] as const;
const SESSION_TYPES = ["PRACTICE", "COMPANY"] as const;

export type StuckSessionFilters = {
  search?: string;
  status?: "LIVE" | "READY";
  type?: "PRACTICE" | "COMPANY";
  domain?: string;
  minAgeHours?: number;
  maxAgeHours?: number;
  fromDate?: Date;
  toDate?: Date;
};

function parseStuckAgeHours(value: string | null): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  return parsed;
}

export function buildStuckSessionWhere(
  filters: StuckSessionFilters = {},
  now = Date.now(),
): Prisma.InterviewSessionWhereInput {
  const oneHourAgo = new Date(now - STUCK_SESSION_AGE_MS);
  const minAgeHours = filters.minAgeHours ?? 1;
  const maxAge = filters.maxAgeHours
    ? new Date(now - filters.maxAgeHours * 60 * 60 * 1000)
    : undefined;
  const minAge = new Date(now - minAgeHours * 60 * 60 * 1000);

  const createdAt: Prisma.DateTimeFilter = {
    lt: minAge,
    ...(maxAge ? { gte: maxAge } : {}),
    ...(filters.fromDate ? { gte: filters.fromDate } : {}),
    ...(filters.toDate ? { lte: filters.toDate } : {}),
  };

  // Stuck sessions must be older than 1 hour; minAgeHours cannot be below that.
  if (createdAt.lt && createdAt.lt > oneHourAgo) {
    createdAt.lt = oneHourAgo;
  }

  const where: Prisma.InterviewSessionWhereInput = {
    status: filters.status ? filters.status : { in: [...STUCK_STATUSES] },
    createdAt,
    ...(filters.type ? { sessionType: filters.type } : {}),
    ...(filters.domain ? { domain: { contains: filters.domain, mode: "insensitive" } } : {}),
    ...(filters.search
      ? {
          OR: [
            { candidateName: { contains: filters.search, mode: "insensitive" } },
            { candidateEmail: { contains: filters.search, mode: "insensitive" } },
            { companyName: { contains: filters.search, mode: "insensitive" } },
            { domain: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  return where;
}

export function parseStuckSessionFiltersFromUrl(url: URL): StuckSessionFilters {
  const statusParam = url.searchParams.get("status")?.trim().toUpperCase() ?? "";
  const typeParam = url.searchParams.get("type")?.trim().toUpperCase() ?? "";
  const fromRaw = url.searchParams.get("fromDate")?.trim();
  const toRaw = url.searchParams.get("toDate")?.trim();

  let fromDate: Date | undefined;
  let toDate: Date | undefined;
  if (fromRaw) {
    const parsed = new Date(fromRaw);
    if (!Number.isNaN(parsed.getTime())) fromDate = parsed;
  }
  if (toRaw) {
    const parsed = new Date(toRaw);
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(23, 59, 59, 999);
      toDate = parsed;
    }
  }

  return {
    search: url.searchParams.get("search")?.trim() ?? "",
    status: STUCK_STATUSES.includes(statusParam as (typeof STUCK_STATUSES)[number])
      ? (statusParam as "LIVE" | "READY")
      : undefined,
    type: SESSION_TYPES.includes(typeParam as (typeof SESSION_TYPES)[number])
      ? (typeParam as "PRACTICE" | "COMPANY")
      : undefined,
    domain: url.searchParams.get("domain")?.trim() ?? "",
    minAgeHours: parseStuckAgeHours(url.searchParams.get("minAgeHours")),
    maxAgeHours: parseStuckAgeHours(url.searchParams.get("maxAgeHours")),
    fromDate,
    toDate,
  };
}

export function getStuckSessionWhere(now = Date.now()): Prisma.InterviewSessionWhereInput {
  return buildStuckSessionWhere({}, now);
}

export async function deleteMasterStuckSession(
  prisma: PrismaClient,
  sessionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, ...getStuckSessionWhere() },
    select: {
      id: true,
      candidateEmail: true,
      candidateName: true,
      sessionType: true,
      status: true,
    },
  });

  if (!session) {
    return { ok: false, error: "Stuck session not found." };
  }

  try {
    await deleteInterviewVideoAssets(session.id);
  } catch {
    // Video may not exist for stuck sessions.
  }

  await prisma.interviewSession.delete({ where: { id: session.id } });

  await writePlatformAuditLog(prisma, {
    level: "WARNING",
    category: "SESSION",
    title: "Stuck session deleted",
    message: `Master admin deleted stuck ${session.sessionType.toLowerCase()} session (${session.status}) for ${session.candidateEmail ?? session.candidateName ?? "unknown candidate"}.`,
    metadata: { sessionId: session.id, sessionType: session.sessionType, status: session.status },
  });

  return { ok: true };
}
