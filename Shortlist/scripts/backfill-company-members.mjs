/**
 * Backfill CompanyMember ADMIN rows from existing Company.adminEmail.
 * Usage: npx tsx --env-file=.env scripts/backfill-company-members.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    select: { id: true, adminEmail: true },
  });

  let created = 0;
  let skipped = 0;

  for (const company of companies) {
    const email = company.adminEmail.trim().toLowerCase();
    const existing = await prisma.companyMember.findUnique({
      where: { companyId_email: { companyId: company.id, email } },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await prisma.companyMember.create({
      data: {
        companyId: company.id,
        email,
        role: "ADMIN",
        isActive: true,
      },
    });
    created += 1;
  }

  console.log(`Backfill complete: created ${created}, skipped ${skipped}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
