/**
 * One-time migration: hash plaintext company admin passcodes in the database.
 * Usage: node scripts/hash-company-passcodes.mjs
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const SCRYPT_KEY_LEN = 64;

function isHash(stored) {
  const parts = stored.split(":");
  return parts.length === 2 && parts[0].length >= 16 && parts[1].length >= 32;
}

function hashPasscode(passcode) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(passcode, salt, SCRYPT_KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

const prisma = new PrismaClient();

try {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, adminPasscode: true },
  });

  let upgraded = 0;
  let skipped = 0;

  for (const company of companies) {
    if (isHash(company.adminPasscode)) {
      skipped += 1;
      continue;
    }
    await prisma.company.update({
      where: { id: company.id },
      data: { adminPasscode: hashPasscode(company.adminPasscode) },
    });
    upgraded += 1;
    console.log(`Hashed passcode for company: ${company.name}`);
  }

  console.log(`Done. Upgraded ${upgraded}, skipped ${skipped} (already hashed).`);
} finally {
  await prisma.$disconnect();
}
