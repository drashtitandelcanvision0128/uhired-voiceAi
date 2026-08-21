/**
 * Idempotent bootstrap for Coolify / production:
 * - Upserts Uhired company + ADMIN member (company-login)
 * - Creates MasterAdminAccount from MASTER_ADMIN_EMAIL / MASTER_ADMIN_PASSWORD if table empty
 *
 * Runs from docker-entrypoint after migrate (SEED_BOOTSTRAP=true by default).
 * Override company via SEED_COMPANY_* env vars. Set SEED_BOOTSTRAP_FORCE=true to
 * reset company passcode / master password hash on every boot.
 *
 * Usage: node scripts/seed-production-bootstrap.mjs
 */
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const SCRYPT_KEY_LEN = 64;

function hashSecret(value) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(value, salt, SCRYPT_KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

function env(name, fallback = "") {
  return (process.env[name] || fallback).trim();
}

function isTruthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

const FORCE = isTruthy(process.env.SEED_BOOTSTRAP_FORCE);

const COMPANY = {
  name: env("SEED_COMPANY_NAME", "Uhired"),
  domain: env("SEED_COMPANY_DOMAIN", "uhired.com").toLowerCase(),
  adminEmail: env("SEED_COMPANY_EMAIL", "admin@uhired.com").toLowerCase(),
  adminPasscode: env("SEED_COMPANY_PASSCODE", "admin123"),
};

async function seedCompany(prisma) {
  if (!COMPANY.name || !COMPANY.adminEmail || !COMPANY.adminPasscode) {
    console.log("[seed] Skipping company — SEED_COMPANY_* incomplete.");
    return;
  }

  const existing = await prisma.company.findUnique({ where: { name: COMPANY.name } });
  const hashed = hashSecret(COMPANY.adminPasscode);

  let company;
  if (!existing) {
    company = await prisma.company.create({
      data: {
        name: COMPANY.name,
        domain: COMPANY.domain,
        adminEmail: COMPANY.adminEmail,
        adminPasscode: hashed,
        isActive: true,
        interviewerName: "Sana",
        interviewerVoiceGender: "FEMALE",
      },
    });
    console.log(`[seed] Created company "${COMPANY.name}" (${company.id})`);
  } else {
    const data = {
      domain: COMPANY.domain,
      adminEmail: COMPANY.adminEmail,
      isActive: true,
    };
    if (FORCE) {
      data.adminPasscode = hashed;
    }
    company = await prisma.company.update({
      where: { id: existing.id },
      data,
    });
    console.log(
      FORCE
        ? `[seed] Updated company "${COMPANY.name}" (passcode reset)`
        : `[seed] Company "${COMPANY.name}" already present — kept existing passcode`,
    );
  }

  const memberEmail = COMPANY.adminEmail;
  const member = await prisma.companyMember.findUnique({
    where: { companyId_email: { companyId: company.id, email: memberEmail } },
  });

  if (!member) {
    await prisma.companyMember.create({
      data: {
        companyId: company.id,
        email: memberEmail,
        name: "Uhired Admin",
        role: "ADMIN",
        isActive: true,
      },
    });
    console.log(`[seed] Created ADMIN member ${memberEmail}`);
  } else if (member.role !== "ADMIN" || !member.isActive) {
    await prisma.companyMember.update({
      where: { id: member.id },
      data: { role: "ADMIN", isActive: true },
    });
    console.log(`[seed] Ensured ADMIN member ${memberEmail}`);
  } else {
    console.log(`[seed] Member ${memberEmail} already ADMIN`);
  }
}

async function seedMasterAdmin(prisma) {
  const email = env("MASTER_ADMIN_EMAIL").toLowerCase();
  const password = env("MASTER_ADMIN_PASSWORD");

  if (!email || !password) {
    console.log(
      "[seed] Skipping master admin — set MASTER_ADMIN_EMAIL and MASTER_ADMIN_PASSWORD in Coolify.",
    );
    return;
  }

  const existingByEmail = await prisma.masterAdminAccount.findUnique({ where: { email } });
  if (existingByEmail) {
    if (FORCE) {
      await prisma.masterAdminAccount.update({
        where: { id: existingByEmail.id },
        data: { passwordHash: hashSecret(password) },
      });
      console.log(`[seed] Reset master admin password for ${email}`);
    } else {
      console.log(`[seed] Master admin ${email} already present`);
    }
    return;
  }

  const any = await prisma.masterAdminAccount.findFirst({ orderBy: { createdAt: "asc" } });
  if (any && !FORCE) {
    console.log(
      `[seed] MasterAdminAccount already has rows (e.g. ${any.email}) — not creating ${email}`,
    );
    return;
  }

  await prisma.masterAdminAccount.create({
    data: {
      email,
      passwordHash: hashSecret(password),
    },
  });
  console.log(`[seed] Created master admin ${email}`);
}

async function main() {
  const datasourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!datasourceUrl) {
    throw new Error("Set DIRECT_URL or DATABASE_URL");
  }

  const prisma = new PrismaClient({ datasourceUrl });
  try {
    console.log("[seed] Production bootstrap starting...");
    await seedCompany(prisma);
    await seedMasterAdmin(prisma);
    console.log("[seed] Production bootstrap complete.");
    console.log(
      `[seed] Company login → name=${COMPANY.name} domain=${COMPANY.domain} email=${COMPANY.adminEmail}`,
    );
    console.log("[seed] Master login → MASTER_ADMIN_EMAIL / MASTER_ADMIN_PASSWORD from env");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[seed] Bootstrap failed:", err.message);
  process.exit(1);
});
