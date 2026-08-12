import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureCompanyAdminMember } from "@/lib/company-members";
import { hashCompanyPasscode } from "@/lib/company-passcode";
import { prisma } from "@/lib/prisma";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";

const upsertCompanySchema = z.object({
  companyId: z.string().trim().optional(),
  companyName: z.string().trim().min(1),
  domain: z.string().trim().min(1),
  adminEmail: z.string().trim().email(),
  adminPasscode: z.string().trim().min(1).optional(),
  interviewerName: z.string().trim().max(80).optional(),
  interviewerVoiceGender: z.enum(["MALE", "FEMALE"]).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const listAll = url.searchParams.get("all") === "true";

  if (listAll) {
    const companies = await prisma.company.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        domain: true,
        adminEmail: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      companies: companies.map((company) => ({
        id: company.id,
        companyName: company.name,
        domain: company.domain,
        adminEmail: company.adminEmail,
        isActive: company.isActive,
      })),
    });
  }

  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "10") || 10));
  const search = url.searchParams.get("search")?.trim() ?? "";

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { domain: { contains: search, mode: "insensitive" as const } },
          { adminEmail: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const companies = await prisma.company.findMany({
    where,
    include: {
      sessions: {
        where: { sessionType: "COMPANY" },
        select: { status: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  const total = await prisma.company.count({ where });

  const rows = companies
    .map((company) => ({
      id: company.id,
      companyName: company.name,
      domain: company.domain,
      adminEmail: company.adminEmail,
      hasPasscode: Boolean(company.adminPasscode),
      interviewerName: company.interviewerName ?? "",
      interviewerVoiceGender: company.interviewerVoiceGender,
      isActive: company.isActive,
      totalSessions: company.sessions.length,
      activeSessions: company.sessions.filter((s) => s.status === "LIVE").length,
      lastActivity:
        company.sessions.reduce<Date | null>(
          (latest, s) => (!latest || s.createdAt > latest ? s.createdAt : latest),
          null,
        ) ?? company.updatedAt,
      plan: company.sessions.length >= 10 ? "ENTERPRISE" : "STANDARD",
    }))
    .sort((a, b) => b.totalSessions - a.totalSessions);

  return NextResponse.json({
    metrics: {
      totalCompanies: total,
      activeEnterprise: rows.filter((c) => c.plan === "ENTERPRISE").length,
      totalAiSessions: rows.reduce((sum, c) => sum + c.totalSessions, 0),
      systemHealthPct: 99.9,
    },
    companies: rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

export async function POST(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = upsertCompanySchema.parse(await request.json());

    if (!body.companyId && !body.adminPasscode) {
      return NextResponse.json({ error: "Admin passcode is required for new companies." }, { status: 400 });
    }

    const data = {
      name: body.companyName,
      domain: body.domain.toLowerCase(),
      adminEmail: body.adminEmail.toLowerCase(),
      isActive: body.isActive ?? true,
      ...(body.adminPasscode !== undefined
        ? { adminPasscode: hashCompanyPasscode(body.adminPasscode) }
        : {}),
      ...(body.interviewerName !== undefined
        ? { interviewerName: body.interviewerName || null }
        : {}),
      ...(body.interviewerVoiceGender !== undefined
        ? { interviewerVoiceGender: body.interviewerVoiceGender }
        : {}),
    };

    const company = body.companyId
      ? await prisma.company.update({
          where: { id: body.companyId },
          data,
        })
      : await prisma.company.upsert({
          where: { name: body.companyName },
          update: data,
          create: {
            ...data,
            adminPasscode: hashCompanyPasscode(body.adminPasscode!),
          },
        });

    if (!body.companyId) {
      await ensureCompanyAdminMember(company.id, company.adminEmail, company.name);
    }

    return NextResponse.json({ ok: true, companyId: company.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to save company." }, { status: 500 });
  }
}
