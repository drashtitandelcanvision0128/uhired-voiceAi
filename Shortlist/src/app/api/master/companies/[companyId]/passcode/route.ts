import { NextResponse } from "next/server";
import { z } from "zod";
import { hashCompanyPasscode } from "@/lib/company-passcode";
import { prisma } from "@/lib/prisma";
import { hasMasterSessionFromRequest } from "@/lib/master-auth";

type Context = {
  params: Promise<{ companyId: string }>;
};

const bodySchema = z.object({});

function generatePasscode(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function PATCH(request: Request, context: Context) {
  if (!hasMasterSessionFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { companyId } = await context.params;
  try {
    bodySchema.parse(await request.json());

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    const passcode = generatePasscode(10);
    await prisma.company.update({
      where: { id: companyId },
      data: { adminPasscode: hashCompanyPasscode(passcode) },
    });
    return NextResponse.json({ ok: true, passcode });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to regenerate passcode." }, { status: 500 });
  }
}
