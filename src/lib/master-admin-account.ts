import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { getMasterAdminEmail, getMasterAdminPasswordFromEnv } from "@/lib/master-auth";

const SCRYPT_KEY_LEN = 64;

export type MasterAdminAccountRecord = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};

type MasterAdminAccountDelegate = {
  findFirst: (args: unknown) => Promise<MasterAdminAccountRecord | null>;
  findMany: (args: unknown) => Promise<MasterAdminAccountRecord[]>;
  findUnique: (args: unknown) => Promise<MasterAdminAccountRecord | null>;
  create: (args: unknown) => Promise<MasterAdminAccountRecord>;
  update: (args: unknown) => Promise<MasterAdminAccountRecord>;
  delete: (args: unknown) => Promise<MasterAdminAccountRecord>;
  count: (args?: unknown) => Promise<number>;
};

function getMasterAdminAccountDelegate(prisma: PrismaClient): MasterAdminAccountDelegate | null {
  const delegate = (prisma as unknown as { masterAdminAccount?: MasterAdminAccountDelegate })
    .masterAdminAccount;
  if (!delegate || typeof delegate.findFirst !== "function") {
    return null;
  }
  return delegate;
}

export function hashMasterPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyMasterPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) {
    return false;
  }

  const derived = scryptSync(password, salt, SCRYPT_KEY_LEN).toString("hex");
  const storedBuf = Buffer.from(hash, "hex");
  const derivedBuf = Buffer.from(derived, "hex");
  return storedBuf.length === derivedBuf.length && timingSafeEqual(storedBuf, derivedBuf);
}

export async function getMasterAdminAccount(prisma: PrismaClient) {
  const delegate = getMasterAdminAccountDelegate(prisma);
  if (!delegate) {
    return null;
  }

  try {
    return await delegate.findFirst({
      orderBy: { createdAt: "asc" },
    });
  } catch {
    return null;
  }
}

export async function listMasterAdminAccounts(prisma: PrismaClient) {
  const delegate = getMasterAdminAccountDelegate(prisma);
  if (!delegate || typeof delegate.findMany !== "function") {
    return [];
  }

  try {
    return await delegate.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch {
    return [];
  }
}

export async function getMasterAdminAccountByEmail(prisma: PrismaClient, email: string) {
  const delegate = getMasterAdminAccountDelegate(prisma);
  if (!delegate) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  try {
    if (typeof delegate.findUnique === "function") {
      return await delegate.findUnique({ where: { email: normalizedEmail } });
    }
    return await delegate.findFirst({ where: { email: normalizedEmail } });
  } catch {
    return null;
  }
}

export async function ensureMasterAdminAccountFromEnv(prisma: PrismaClient) {
  const delegate = getMasterAdminAccountDelegate(prisma);
  if (!delegate) {
    return null;
  }

  const existing = await getMasterAdminAccount(prisma);
  if (existing) {
    return existing;
  }

  const email = getMasterAdminEmail();
  const password = getMasterAdminPasswordFromEnv();
  if (!email || !password) {
    return null;
  }

  try {
    return await delegate.create({
      data: {
        email,
        passwordHash: hashMasterPassword(password),
      },
    });
  } catch {
    return null;
  }
}

export async function createMasterAdminAccount(
  prisma: PrismaClient,
  input: { email: string; password: string },
) {
  const delegate = getMasterAdminAccountDelegate(prisma);
  if (!delegate) {
    return null;
  }

  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();
  if (!email || password.length < 6) {
    return null;
  }

  try {
    return await delegate.create({
      data: {
        email,
        passwordHash: hashMasterPassword(password),
      },
    });
  } catch {
    return null;
  }
}

export async function deleteMasterAdminAccount(prisma: PrismaClient, accountId: string) {
  const delegate = getMasterAdminAccountDelegate(prisma);
  if (!delegate || typeof delegate.delete !== "function") {
    return null;
  }

  try {
    const count =
      typeof delegate.count === "function" ? await delegate.count() : (await listMasterAdminAccounts(prisma)).length;
    if (count <= 1) {
      return { error: "Cannot delete the last master admin account." as const };
    }
    await delegate.delete({ where: { id: accountId } });
    return { ok: true as const };
  } catch {
    return null;
  }
}

export async function resolveMasterAdminEmail(prisma: PrismaClient) {
  const account = await ensureMasterAdminAccountFromEnv(prisma);
  return account?.email ?? getMasterAdminEmail();
}

export async function verifyMasterAdminLogin(
  prisma: PrismaClient,
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  if (!normalizedEmail || !normalizedPassword) {
    return { ok: false, error: "Email and password are required." };
  }

  try {
    await ensureMasterAdminAccountFromEnv(prisma);
    const account = await getMasterAdminAccountByEmail(prisma, normalizedEmail);
    if (account) {
      if (!verifyMasterPassword(normalizedPassword, account.passwordHash)) {
        return { ok: false, error: "Invalid master admin credentials." };
      }
      return { ok: true };
    }
  } catch {
    // Fall through to env credentials when the account table/client is unavailable.
  }

  const expectedEmail = getMasterAdminEmail();
  const expectedPassword = getMasterAdminPasswordFromEnv();
  if (!expectedEmail || !expectedPassword) {
    return { ok: false, error: "Master admin credentials are not configured." };
  }

  if (normalizedEmail !== expectedEmail || normalizedPassword !== expectedPassword) {
    return { ok: false, error: "Invalid master admin credentials." };
  }

  return { ok: true };
}

export async function updateMasterAdminAccount(
  prisma: PrismaClient,
  accountId: string,
  data: { email?: string; passwordHash?: string },
) {
  const delegate = getMasterAdminAccountDelegate(prisma);
  if (!delegate || typeof delegate.update !== "function") {
    return null;
  }

  try {
    return await delegate.update({
      where: { id: accountId },
      data,
    });
  } catch {
    return null;
  }
}

export async function findMasterAdminAccountByEmail(
  prisma: PrismaClient,
  email: string,
  excludeId?: string,
) {
  const delegate = getMasterAdminAccountDelegate(prisma);
  if (!delegate) {
    return null;
  }

  try {
    return await delegate.findFirst({
      where: {
        email,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
  } catch {
    return null;
  }
}
