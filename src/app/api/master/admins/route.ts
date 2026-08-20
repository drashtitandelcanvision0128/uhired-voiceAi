import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createMasterAdminAccount,
  ensureMasterAdminAccountFromEnv,
  findMasterAdminAccountByEmail,
  listMasterAdminAccounts,
} from "@/lib/master-admin-account";
import { getMasterSessionEmailFromRequest, hasMasterSessionFromRequest } from "@/lib/master-auth";
import { prisma } from "@/lib/prisma";

const createAdminSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().trim().min(6).max(128),
  confirmPassword: z.string().trim().min(1),
}).superRefine((body, ctx) => {
  if (body.password !== body.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Password and confirmation do not match.",
      path: ["confirmPassword"],
    });
  }
});

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    await ensureMasterAdminAccountFromEnv(prisma);
    const currentEmail = getMasterSessionEmailFromRequest(request);
    const accounts = await listMasterAdminAccounts(prisma);

    return NextResponse.json({
      currentEmail,
      admins: accounts.map((account) => ({
        id: account.id,
        email: account.email,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
        isCurrent: Boolean(currentEmail && account.email === currentEmail),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Unable to load master admins." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    await ensureMasterAdminAccountFromEnv(prisma);
    const body = createAdminSchema.parse(await request.json());
    const email = body.email.trim().toLowerCase();

    const existing = await findMasterAdminAccountByEmail(prisma, email);
    if (existing) {
      return NextResponse.json({ error: "A master admin with that email already exists." }, { status: 409 });
    }

    const created = await createMasterAdminAccount(prisma, {
      email,
      password: body.password,
    });

    if (!created) {
      return NextResponse.json({ error: "Unable to create master admin." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      admin: {
        id: created.id,
        email: created.email,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
      message: "Master admin created.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create master admin." }, { status: 500 });
  }
}
