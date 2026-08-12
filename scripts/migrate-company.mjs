/**
 * Migration script: Create new company and migrate all existing data
 * Run: node scripts/migrate-company.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// New company credentials
const NEW_COMPANY = {
  name: "Uhired",
  domain: "uhired.com",
  adminEmail: "admin@uhired.com",
  adminPasscode: "admin123",
};

async function main() {
  console.log("Starting company migration...\n");

  // 1. Check if new company already exists
  const existingCompany = await prisma.company.findUnique({
    where: { name: NEW_COMPANY.name },
  });

  let companyId;
  if (existingCompany) {
    console.log(`Company "${NEW_COMPANY.name}" already exists with ID: ${existingCompany.id}`);
    companyId = existingCompany.id;
  } else {
    // 2. Create new company
    const newCompany = await prisma.company.create({
      data: {
        name: NEW_COMPANY.name,
        domain: NEW_COMPANY.domain,
        adminEmail: NEW_COMPANY.adminEmail,
        adminPasscode: NEW_COMPANY.adminPasscode,
        isActive: true,
      },
    });
    companyId = newCompany.id;
    console.log(`Created new company with ID: ${companyId}`);
  }

  // 3. Migrate orphaned sessions (sessions without companyId)
  const orphanedSessions = await prisma.interviewSession.findMany({
    where: {
      companyId: null,
      sessionType: "COMPANY",
    },
  });

  console.log(`\nFound ${orphanedSessions.length} orphaned company sessions to migrate...`);

  for (const session of orphanedSessions) {
    await prisma.interviewSession.update({
      where: { id: session.id },
      data: {
        companyId,
        companyName: NEW_COMPANY.name,
      },
    });
    console.log(`  Migrated session: ${session.accessCode}`);
  }

  // 4. Migrate all requirements to the new company
  const allRequirements = await prisma.requirement.findMany();

  console.log(`\nFound ${allRequirements.length} requirements to migrate...`);

  for (const requirement of allRequirements) {
    await prisma.requirement.update({
      where: { id: requirement.id },
      data: { companyId },
    });
    console.log(`  Migrated requirement: ${requirement.topic}`);
  }

  // 5. Migrate all candidates to the new company
  const allCandidates = await prisma.candidate.findMany();

  console.log(`\nFound ${allCandidates.length} candidates to migrate...`);

  for (const candidate of allCandidates) {
    await prisma.candidate.update({
      where: { id: candidate.id },
      data: { companyId },
    });
    console.log(`  Migrated candidate: ${candidate.name}`);
  }

  // 6. Migrate all scorecard share links to the new company
  const allShareLinks = await prisma.scorecardShareLink.findMany();

  console.log(`\nFound ${allShareLinks.length} scorecard share links to migrate...`);

  for (const link of allShareLinks) {
    await prisma.scorecardShareLink.update({
      where: { id: link.id },
      data: { companyId },
    });
    console.log(`  Migrated share link: ${link.tokenHash}`);
  }

  console.log("\n=== Migration Complete ===\n");
  console.log("--- Company Admin Login (http://localhost:3000/company-login) ---");
  console.log("Company name:  ", NEW_COMPANY.name);
  console.log("Company domain:", NEW_COMPANY.domain);
  console.log("Company email: ", NEW_COMPANY.adminEmail);
  console.log("Passcode:      ", NEW_COMPANY.adminPasscode);
  console.log("Company ID:    ", companyId);
  console.log("\n");
}

main()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
