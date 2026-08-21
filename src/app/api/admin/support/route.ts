import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCompanyAdminSessionFromCookieHeader } from "@/lib/company-admin-auth";
import { createSupportInquiry, listSupportInquiries } from "@/lib/support-inquiry-db";

const supportSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email("Valid email is required."),
  subject: z.string().trim().min(1, "Subject is required."),
  message: z.string().trim().min(1, "Message is required."),
});

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function GET(request: Request) {
  try {
    const authCompany = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
    if (!authCompany) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const company = await prisma.company.findUnique({
      where: { id: authCompany.companyId },
      select: { adminEmail: true, name: true, domain: true },
    });
    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    const adminEmail = company.adminEmail.toLowerCase();
    const inquiries = await listSupportInquiries(prisma, {
      where: { source: "COMPANY_ADMIN", email: adminEmail },
      take: 50,
    });

    const tickets = inquiries.map((row) => ({
      id: row.id,
      subject: row.subject,
      message: row.message,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("[admin/support] GET failed:", error);
    return NextResponse.json({ error: "Unable to load support tickets." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authCompany = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
    if (!authCompany) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = supportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const company = await prisma.company.findUnique({
      where: { id: authCompany.companyId },
      select: { adminEmail: true, name: true, domain: true },
    });
    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    const email = parsed.data.email.toLowerCase();
    const message = `${parsed.data.message.trim()}\n\n---\nCompany: ${company.name}\nDomain: ${company.domain}\nAdmin email: ${company.adminEmail}\n`;

    const ticket = await createSupportInquiry(prisma, {
      name: parsed.data.name.trim(),
      email,
      subject: parsed.data.subject.trim(),
      message,
      source: "COMPANY_ADMIN",
      clientIp: getClientIp(request),
      companyId: authCompany.companyId,
    });

    return NextResponse.json({
      ok: true,
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        createdAt: ticket.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[admin/support] POST failed:", error);
    return NextResponse.json({ error: "Unable to submit support request." }, { status: 500 });
  }
}
