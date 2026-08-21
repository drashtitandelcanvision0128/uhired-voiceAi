import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCompanyAdminSessionFromCookieHeader } from "@/lib/company-admin-auth";
import { parseQuestionResultsFromScorecard } from "@/lib/parse-question-results";
import { gradeCompletedSessionQuestions } from "@/lib/session-question-grading";

type Context = {
  params: Promise<{ sessionId: string }>;
};

export const maxDuration = 300;

export async function POST(request: Request, context: Context) {
  const authCompany = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
  if (!authCompany) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, companyId: authCompany.companyId, status: "COMPLETED" },
    include: { scorecard: true },
  });

  if (!session) {
    return NextResponse.json({ error: "Completed session not found." }, { status: 404 });
  }

  const result = await gradeCompletedSessionQuestions(sessionId, {
    companyId: authCompany.companyId,
  });
  if (!result) {
    return NextResponse.json(
      {
        error:
          "Unable to grade answers. Add interview questions to the requirement or ensure OPENAI_API_KEY is set.",
      },
      { status: 400 },
    );
  }

  const updated = await prisma.scorecard.findUnique({ where: { sessionId } });

  return NextResponse.json({
    ok: true,
    accuracyPercent: result.accuracyPercent,
    questionResults: parseQuestionResultsFromScorecard(updated?.questionResults),
  });
}
