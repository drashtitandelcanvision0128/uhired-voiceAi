import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCandidatePortalEmailFromCookieHeader } from "@/lib/candidate-portal-auth";

export async function GET(request: Request) {
  const email = getCandidatePortalEmailFromCookieHeader(request.headers.get("cookie"));
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const sessions = await prisma.interviewSession.findMany({
    where: {
      candidateEmail: { equals: email, mode: "insensitive" },
      status: "COMPLETED",
    },
    orderBy: { endedAt: "desc" },
    take: 50,
    select: {
      id: true,
      sessionType: true,
      status: true,
      candidateName: true,
      domain: true,
      topic: true,
      positionTitle: true,
      companyName: true,
      durationMin: true,
      startedAt: true,
      endedAt: true,
      scorecard: {
        select: {
          overallScore: true,
          communication: true,
          domainDepth: true,
          confidence: true,
          summary: true,
        },
      },
    },
  });

  const inProgress = await prisma.interviewSession.findMany({
    where: {
      candidateEmail: { equals: email, mode: "insensitive" },
      status: { in: ["READY", "LIVE"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      id: true,
      sessionType: true,
      status: true,
      domain: true,
      topic: true,
      positionTitle: true,
      companyName: true,
      durationMin: true,
    },
  });

  return NextResponse.json({
    email,
    inProgress,
    completed: sessions,
    stats: {
      totalCompleted: sessions.length,
      practiceCount: sessions.filter((s) => s.sessionType === "PRACTICE").length,
      companyCount: sessions.filter((s) => s.sessionType === "COMPANY").length,
      avgScore:
        sessions.length > 0
          ? Math.round(
              sessions.reduce((sum, s) => sum + (s.scorecard?.overallScore ?? 0), 0) /
                sessions.length,
            )
          : null,
    },
  });
}
