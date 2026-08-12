import { NextResponse } from "next/server";
import { z } from "zod";
import type { CompanyMemberRole } from "@prisma/client";
import { requireCompanyPermission } from "@/lib/company-admin-api";
import { normalizeMemberRole, roleLabel } from "@/lib/company-rbac";
import { withCompanyTenantScope } from "@/lib/prisma-tenant-scope";

const createSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().max(120).optional(),
  role: z.string().trim(),
});

export async function GET(request: Request) {
  const authOrResponse = await requireCompanyPermission(request, "team:manage");
  if (authOrResponse instanceof NextResponse) return authOrResponse;
  const auth = authOrResponse;

  const members = await withCompanyTenantScope(auth.companyId, async (tx) => {
    return tx.companyMember.findMany({
      where: { companyId: auth.companyId },
      orderBy: [{ role: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
  });

  return NextResponse.json({
    members: members.map((member) => ({
      ...member,
      roleLabel: roleLabel(member.role),
      lastLoginAt: member.lastLoginAt?.toISOString() ?? null,
      createdAt: member.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const authOrResponse = await requireCompanyPermission(request, "team:manage");
  if (authOrResponse instanceof NextResponse) return authOrResponse;
  const auth = authOrResponse;

  try {
    const body = createSchema.parse(await request.json());
    const role = normalizeMemberRole(body.role);
    if (!role) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const member = await withCompanyTenantScope(auth.companyId, async (tx) => {
      return tx.companyMember.create({
        data: {
          companyId: auth.companyId,
          email,
          name: body.name?.trim() || null,
          role,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });
    });

    return NextResponse.json({
      member: {
        ...member,
        roleLabel: roleLabel(member.role),
        createdAt: member.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to add team member." }, { status: 500 });
  }
}
