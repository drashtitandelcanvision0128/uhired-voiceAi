import { NextResponse } from "next/server";
import {
  deleteMasterAdminAccount,
  ensureMasterAdminAccountFromEnv,
  getMasterAdminAccountByEmail,
} from "@/lib/master-admin-account";
import { getMasterSessionEmailFromRequest, hasMasterSessionFromRequest } from "@/lib/master-auth";
import { prisma } from "@/lib/prisma";

type Context = {
  params: Promise<{ adminId: string }>;
};

export async function DELETE(request: Request, context: Context) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { adminId } = await context.params;
  if (!adminId) {
    return NextResponse.json({ error: "Admin id is required." }, { status: 400 });
  }

  try {
    await ensureMasterAdminAccountFromEnv(prisma);

    const currentEmail = getMasterSessionEmailFromRequest(request);
    if (currentEmail) {
      const current = await getMasterAdminAccountByEmail(prisma, currentEmail);
      if (current?.id === adminId) {
        return NextResponse.json(
          { error: "You cannot delete the account you are currently signed in with." },
          { status: 400 },
        );
      }
    }

    const result = await deleteMasterAdminAccount(prisma, adminId);
    if (!result) {
      return NextResponse.json({ error: "Unable to delete master admin." }, { status: 500 });
    }
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: "Master admin deleted." });
  } catch {
    return NextResponse.json({ error: "Unable to delete master admin." }, { status: 500 });
  }
}
