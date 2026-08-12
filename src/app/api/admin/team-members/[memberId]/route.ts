import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCompanyPermission } from "@/lib/company-admin-api";
import { normalizeMemberRole, roleLabel } from "@/lib/company-rbac";
import { withCompanyTenantScope } from "@/lib/prisma-tenant-scope";

const patchSchema = z.object({
  name: z.string().trim().max(120).optional(),
  role: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ memberId: string }> },
) {
  const authOrResponse = await requireCompanyPermission(request, "team:manage");
  if (authOrResponse instanceof NextResponse) return authOrResponse;
  const auth = authOrResponse;

  const { memberId } = await context.params;

  try {
    const body = patchSchema.parse(await request.json());
    const role = body.role ? normalizeMemberRole(body.role) : undefined;
    if (body.role && !role) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    if (memberId === auth.memberId && body.isActive === false) {
      return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
    }

    const member = await withCompanyTenantScope(auth.companyId, async (tx) => {
      const existing = await tx.companyMember.findFirst({
        where: { id: memberId, companyId: auth.companyId },
      });
      if (!existing) return null;

      return tx.companyMember.update({
        where: { id: memberId },
        data: {
          name: body.name?.trim() || existing.name,
          role: role ?? existing.role,
          isActive: body.isActive ?? existing.isActive,
        },
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

    if (!member) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    return NextResponse.json({
      member: {
        ...member,
        roleLabel: roleLabel(member.role),
        lastLoginAt: member.lastLoginAt?.toISOString() ?? null,
        createdAt: member.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update team member." }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ memberId: string }> },
) {
  const authOrResponse = await requireCompanyPermission(request, "team:manage");
  if (authOrResponse instanceof NextResponse) return authOrResponse;
  const auth = authOrResponse;

  const { memberId } = await context.params;
  if (memberId === auth.memberId) {
    return NextResponse.json({ error: "You cannot remove your own account." }, { status: 400 });
  }

  const deleted = await withCompanyTenantScope(auth.companyId, async (tx) => {
    const existing = await tx.companyMember.findFirst({
      where: { id: memberId, companyId: auth.companyId },
    });
    if (!existing) return false;
    await tx.companyMember.delete({ where: { id: memberId } });
    return true;
  });

  if (!deleted) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
