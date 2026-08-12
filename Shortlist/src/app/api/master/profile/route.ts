import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ensureMasterAdminAccountFromEnv,
  findMasterAdminAccountByEmail,
  hashMasterPassword,
  updateMasterAdminAccount,
  verifyMasterPassword,
} from "@/lib/master-admin-account";
import { getMasterAdminEmail } from "@/lib/master-auth";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";
import { getLastSuccessfulMasterLogin } from "@/lib/master-login-audit";
import { prisma } from "@/lib/prisma";

const updateProfileSchema = z
  .object({
    currentPassword: z.string().trim().min(1),
    newEmail: z.string().trim().email().optional(),
    newPassword: z.string().trim().min(6).max(128).optional(),
    confirmPassword: z.string().trim().min(1).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.newPassword && body.newPassword !== body.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "New password and confirmation do not match.",
        path: ["confirmPassword"],
      });
    }
    if (!body.newEmail && !body.newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a new email or new password to update.",
        path: ["newEmail"],
      });
    }
  });

export async function GET(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const account = await ensureMasterAdminAccountFromEnv(prisma);
    const email = account?.email ?? getMasterAdminEmail();
    const lastLogin = email ? await getLastSuccessfulMasterLogin(prisma, email) : null;

    return NextResponse.json({
      email,
      role: "Master Admin",
      initials: email.charAt(0).toUpperCase() || "M",
      hasStoredAccount: Boolean(account),
      lastLoginAt: lastLogin?.createdAt.toISOString() ?? null,
      createdAt: account?.createdAt.toISOString() ?? null,
      updatedAt: account?.updatedAt.toISOString() ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load profile." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = updateProfileSchema.parse(await request.json());
    const account = await ensureMasterAdminAccountFromEnv(prisma);

    if (!account) {
      return NextResponse.json(
        { error: "Master admin account is not configured. Set MASTER_ADMIN_EMAIL and MASTER_ADMIN_PASSWORD." },
        { status: 400 },
      );
    }

    if (!verifyMasterPassword(body.currentPassword, account.passwordHash)) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    const nextEmail = body.newEmail?.trim().toLowerCase();
    if (nextEmail && nextEmail !== account.email) {
      const clash = await findMasterAdminAccountByEmail(prisma, nextEmail, account.id);
      if (clash) {
        return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
      }
    }

    const updated = await updateMasterAdminAccount(prisma, account.id, {
      ...(nextEmail ? { email: nextEmail } : {}),
      ...(body.newPassword ? { passwordHash: hashMasterPassword(body.newPassword) } : {}),
    });

    if (!updated) {
      return NextResponse.json({ error: "Unable to update profile." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      email: updated.email,
      updatedAt: updated.updatedAt.toISOString(),
      message: body.newPassword && nextEmail
        ? "Email and password updated."
        : body.newPassword
          ? "Password updated."
          : "Email updated.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to update profile." }, { status: 500 });
  }
}
