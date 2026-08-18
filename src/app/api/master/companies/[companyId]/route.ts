import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";

type Context = {
  params: Promise<{ companyId: string }>;
};

export async function GET(request: Request, context: Context) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { companyId } = await context.params;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      domain: true,
      adminEmail: true,
      interviewerName: true,
      interviewerVoiceGender: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          sessions: true,
          candidates: true,
          requirements: true,
        },
      },
    },
  });

  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const liveSessions = await prisma.interviewSession.count({
    where: { companyId, status: "LIVE" },
  });

  return NextResponse.json({
    id: company.id,
    companyName: company.name,
    domain: company.domain,
    adminEmail: company.adminEmail,
    interviewerName: company.interviewerName ?? "",
    interviewerVoiceGender: company.interviewerVoiceGender,
    isActive: company.isActive,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
    totalSessions: company._count.sessions,
    liveSessions,
    candidateCount: company._count.candidates,
    requirementCount: company._count.requirements,
  });
}

export async function DELETE(request: Request, context: Context) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { companyId } = await context.params;
    const existing = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    await prisma.company.delete({ where: { id: companyId } });
    return NextResponse.json({ ok: true, companyName: existing.name });
  } catch {
    return NextResponse.json({ error: "Unable to delete company." }, { status: 500 });
  }
}
