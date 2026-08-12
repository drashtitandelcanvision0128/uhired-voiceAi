import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const email = "admin@uhired.com";

async function main() {
  console.log("1) companyMember without bypass...");
  try {
    const m = await prisma.companyMember.findFirst({
      where: { email },
      include: { company: true },
    });
    console.log("   ok:", m?.id ?? "null");
  } catch (e) {
    console.error("   FAIL:", e.message);
  }

  console.log("2) companyMember with bypass transaction...");
  try {
    const m = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      return tx.companyMember.findFirst({
        where: { email },
        include: { company: true },
      });
    });
    console.log("   ok:", m?.id ?? "null");
  } catch (e) {
    console.error("   FAIL:", e.message);
  }

  console.log("3) company table...");
  const c = await prisma.company.findFirst({ where: { adminEmail: email } });
  console.log("   company:", c?.id, c?.name, "passcode hash?", c?.adminPasscode?.slice(0, 10));

  try {
    const res = await fetch("http://localhost:3000/api/company-auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyEmail: email, passcode: "admin123" }),
    });
    console.log("4) login API:", res.status, await res.text());
  } catch (e) {
    console.error("4) dev server:", e.message);
  }
}

main().finally(() => prisma.$disconnect());
