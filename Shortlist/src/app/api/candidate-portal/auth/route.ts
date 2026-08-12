import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getCandidatePortalEmailFromCookieHeader,
  hashPortalOtpCode,
  setCandidatePortalSessionCookie,
} from "@/lib/candidate-portal-auth";
import { CANDIDATE_PORTAL_COOKIE } from "@/lib/session-cookies";

const bodySchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().min(6).max(6),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const email = body.email.toLowerCase();
    const codeHash = hashPortalOtpCode(body.code);

    const otp = await prisma.candidatePortalOtp.findFirst({
      where: {
        email,
        codeHash,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 401 });
    }

    await prisma.candidatePortalOtp.deleteMany({ where: { email } });

    const response = NextResponse.json({ ok: true });
    await setCandidatePortalSessionCookie(response, email);
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to verify code." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const email = getCandidatePortalEmailFromCookieHeader(request.headers.get("cookie"));
  if (!email) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({ authenticated: true, email });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: CANDIDATE_PORTAL_COOKIE,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
