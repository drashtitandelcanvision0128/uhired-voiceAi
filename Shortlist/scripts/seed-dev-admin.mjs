/**
 * Local dev: creates/updates a demo company for /company-login
 * Run: node scripts/seed-dev-admin.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO = {
  name: "Uhired",
  domain: "uhired.com",
  adminEmail: "admin@uhired.com",
  adminPasscode: "admin123",
};

async function main() {
  const company = await prisma.company.upsert({
    where: { name: DEMO.name },
    create: {
      name: DEMO.name,
      domain: DEMO.domain,
      adminEmail: DEMO.adminEmail,
      adminPasscode: DEMO.adminPasscode,
      isActive: true,
    },
    update: {
      domain: DEMO.domain,
      adminEmail: DEMO.adminEmail,
      adminPasscode: DEMO.adminPasscode,
      isActive: true,
    },
  });

  console.log("\n--- Company admin login (http://localhost:3000/company-login) ---");
  console.log("Company name:  ", DEMO.name);
  console.log("Company domain:", DEMO.domain);
  console.log("Company email: ", DEMO.adminEmail);
  console.log("Passcode:      ", DEMO.adminPasscode);
  console.log("Company ID:    ", company.id);
  console.log("\n--- Master portal (http://localhost:3000/master-login) ---");
  console.log("Email:    MASTER_ADMIN_EMAIL from your .env file");
  console.log("Password: MASTER_ADMIN_PASSWORD from your .env file");
  console.log("(Legacy key login still works via MASTER_ADMIN_KEY for API/scripts)");
  console.log("");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
