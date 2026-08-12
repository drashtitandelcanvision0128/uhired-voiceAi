import { PrismaClient } from "@prisma/client";
import { createHmac, timingSafeEqual } from "node:crypto";

const prisma = new PrismaClient();
const email = "admin@uhired.com";
const passcode = "admin123";

function verifyCompanyPasscode(plain, stored) {
  if (!stored) return false;
  if (stored.startsWith("scrypt:")) {
    // dynamic import scrypt verify
    return false;
  }
  return plain === stored;
}

async function main() {
  const member = await prisma.companyMember.findFirst({
    where: { email },
    include: { company: true },
  });
  if (!member) {
    console.log("no member");
    return;
  }
  console.log("member role:", member.role);
  console.log("stored passcode prefix:", member.company.adminPasscode.slice(0, 20));

  const { verifyCompanyPasscode: v, isCompanyPasscodeHash } = await import(
    "../src/lib/company-passcode.ts"
  );
  console.log("is hash:", isCompanyPasscodeHash(member.company.adminPasscode));
  console.log("verify:", v(passcode, member.company.adminPasscode));

  const { touchMemberLogin } = await import("../src/lib/company-members.ts");
  try {
    await touchMemberLogin(member.id);
    console.log("touchMemberLogin ok");
  } catch (e) {
    console.error("touchMemberLogin fail:", e);
  }

  const { setCompanyAdminSessionCookie, createCompanySessionToken } = await import(
    "../src/lib/company-admin-auth.ts"
  );
  try {
    const token = await createCompanySessionToken({
      companyId: member.company.id,
      companyName: member.company.name,
      memberId: member.id,
      memberEmail: member.email,
      role: member.role,
    });
    console.log("token length:", token.length);
  } catch (e) {
    console.error("session token fail:", e);
  }
}

main().finally(() => prisma.$disconnect());
