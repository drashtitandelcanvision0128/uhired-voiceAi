import { NextResponse } from "next/server";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { listSupportInquiries } from "@/lib/support-inquiry-db";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ query, results: [] });
  }

  try {
    const [companies, sessions, supportRows] = await Promise.all([
      prisma.company.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { domain: { contains: query, mode: "insensitive" } },
            { adminEmail: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 8,
        select: { id: true, name: true, domain: true, adminEmail: true, isActive: true },
      }),
      prisma.interviewSession.findMany({
        where: {
          OR: [
            { candidateName: { contains: query, mode: "insensitive" } },
            { candidateEmail: { contains: query, mode: "insensitive" } },
            { companyName: { contains: query, mode: "insensitive" } },
            { domain: { contains: query, mode: "insensitive" } },
            { accessCode: { contains: query, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          sessionType: true,
          candidateName: true,
          candidateEmail: true,
          companyName: true,
          domain: true,
          status: true,
          createdAt: true,
        },
      }),
      listSupportInquiries(prisma, { where: { search: query }, take: 8 }),
    ]);

    const promoCodes = await prisma.promoCode.findMany({
      where: { code: { contains: query, mode: "insensitive" } },
      take: 5,
      select: { id: true, code: true, isActive: true, durationMin: true },
    });

    const results = [
      ...companies.map((company) => ({
        id: `company-${company.id}`,
        type: "company" as const,
        title: company.name,
        subtitle: `${company.domain} · ${company.adminEmail}`,
        meta: company.isActive ? "Active" : "Inactive",
        href: `/master/companies/${company.id}`,
      })),
      ...sessions.map((session) => ({
        id: `session-${session.id}`,
        type: "session" as const,
        title: session.candidateName ?? session.companyName ?? "Interview session",
        subtitle: `${session.domain} · ${session.candidateEmail ?? "No email"}`,
        meta: `${session.sessionType} · ${session.status}`,
        href:
          session.sessionType === "PRACTICE"
            ? `/master/practice-sessions/${session.id}`
            : `/master/company-sessions?sessionId=${session.id}`,
      })),
      ...supportRows.map((inquiry) => ({
        id: `support-${inquiry.id}`,
        type: "support" as const,
        title: inquiry.subject,
        subtitle: `${inquiry.name} · ${inquiry.email}`,
        meta: inquiry.status,
        href: `/master/support?id=${inquiry.id}`,
      })),
      ...promoCodes.map((promo) => ({
        id: `promo-${promo.id}`,
        type: "promo" as const,
        title: promo.code,
        subtitle: `${promo.durationMin} min access`,
        meta: promo.isActive ? "Active" : "Inactive",
        href: `/master/promo-codes?search=${encodeURIComponent(promo.code)}`,
      })),
    ];

    return NextResponse.json({ query, results, total: results.length });
  } catch {
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
