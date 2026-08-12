import { prisma } from "@/lib/prisma";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function sanitizeCompanySuffix(companyName: string): string {
  const cleaned = companyName.replace(/[^a-zA-Z0-9]/g, "");
  return cleaned || "Company";
}

export function generateCandidateInviteCode(companyName: string): string {
  let token = "";
  for (let index = 0; index < 10; index += 1) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${token}${sanitizeCompanySuffix(companyName)}`;
}

async function isAccessCodeTaken(accessCode: string): Promise<boolean> {
  const [invite, requirement, session] = await Promise.all([
    prisma.requirementInvite.findUnique({ where: { accessCode }, select: { id: true } }),
    prisma.requirement.findUnique({ where: { accessCode }, select: { id: true } }),
    prisma.interviewSession.findUnique({ where: { accessCode }, select: { id: true } }),
  ]);
  return Boolean(invite || requirement || session);
}

export async function generateUniqueCandidateInviteCode(companyName: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = generateCandidateInviteCode(companyName);
    if (!(await isAccessCodeTaken(code))) {
      return code;
    }
  }
  throw new Error("Unable to generate a unique interview code.");
}
