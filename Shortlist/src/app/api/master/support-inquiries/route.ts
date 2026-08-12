import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import {
  countSupportInquiries,
  countSupportInquiriesBySource,
  countSupportInquiriesByStatus,
  listSupportInquiries,
  updateSupportInquiryStatus,
} from "@/lib/support-inquiry-db";

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "10") || 10));
    const status = url.searchParams.get("status")?.trim().toUpperCase();
    const source = url.searchParams.get("source")?.trim().toUpperCase();
    const search = url.searchParams.get("search")?.trim() ?? "";

    const where = {
      ...(status && status !== "ALL" ? { status: status as "NEW" | "READ" | "REPLIED" | "ARCHIVED" } : {}),
      ...(source && source !== "ALL"
        ? { source: source as "PUBLIC_CONTACT" | "COMPANY_ADMIN" }
        : {}),
      ...(search ? { search } : {}),
    };

    const [inquiries, total, newCount, readCount, repliedCount, publicContactCount, companyAdminCount] =
      await Promise.all([
        listSupportInquiries(prisma, {
          where,
          take: pageSize,
          skip: (page - 1) * pageSize,
        }),
        countSupportInquiries(prisma, { where }),
        countSupportInquiriesByStatus(prisma, "NEW"),
        countSupportInquiriesByStatus(prisma, "READ"),
        countSupportInquiriesByStatus(prisma, "REPLIED"),
        countSupportInquiriesBySource(prisma, "PUBLIC_CONTACT"),
        countSupportInquiriesBySource(prisma, "COMPANY_ADMIN"),
      ]);

    return NextResponse.json({
      summary: {
        total,
        newCount,
        readCount,
        repliedCount,
        publicContactCount,
        companyAdminCount,
      },
      inquiries: inquiries.map((inquiry) => ({
        id: inquiry.id,
        name: inquiry.name,
        email: inquiry.email,
        subject: inquiry.subject,
        message: inquiry.message,
        source: inquiry.source,
        status: inquiry.status,
        clientIp: inquiry.clientIp,
        readAt: inquiry.readAt?.toISOString() ?? null,
        createdAt: inquiry.createdAt.toISOString(),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to load support inquiries." }, { status: 500 });
  }
}

const patchSchema = z.object({
  inquiryId: z.string().trim().min(1),
  status: z.enum(["NEW", "READ", "REPLIED", "ARCHIVED"]),
});

export async function PATCH(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = patchSchema.parse(await request.json());
    const updated = await updateSupportInquiryStatus(prisma, body.inquiryId, body.status);

    return NextResponse.json({
      ok: true,
      inquiry: {
        id: updated.id,
        status: updated.status,
        readAt: updated.readAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update inquiry." }, { status: 500 });
  }
}
