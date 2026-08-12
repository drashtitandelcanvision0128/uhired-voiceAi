import { NextResponse } from "next/server";
import {
  generateQuestionsFromJobDescription,
  generateSampleAnswer,
  improveAnswer,
} from "@/lib/job-description-to-questions";
import { getCompanyAdminSessionFromCookieHeader } from "@/lib/company-admin-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    if (action === "generate-questions") {
      const authCompany = await getCompanyAdminSessionFromCookieHeader(request.headers.get("cookie"));
      if (!authCompany) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { jobDescription, positionTitle, domain, keySkills, questionCount } = params;
      
      if (!jobDescription) {
        return NextResponse.json(
          { error: "Job description is required" },
          { status: 400 }
        );
      }

      const questions = await generateQuestionsFromJobDescription({
        jobDescription,
        positionTitle,
        domain,
        keySkills,
        questionCount: Math.min(5, questionCount || 5),
      });

      return NextResponse.json({ questions });
    }

    if (action === "sample-answer") {
      const { question, jobDescription, domain } = params;
      
      if (!question) {
        return NextResponse.json(
          { error: "Question is required" },
          { status: 400 }
        );
      }

      const sampleAnswer = await generateSampleAnswer(question, jobDescription, domain);

      return NextResponse.json({ sampleAnswer });
    }

    if (action === "improve-answer") {
      const { question, candidateAnswer, jobDescription, domain } = params;
      
      if (!question || !candidateAnswer) {
        return NextResponse.json(
          { error: "Question and candidate answer are required" },
          { status: 400 }
        );
      }

      const feedback = await improveAnswer(question, candidateAnswer, jobDescription, domain);

      return NextResponse.json({ feedback });
    }

    return NextResponse.json(
      { error: "Invalid action. Use: generate-questions, sample-answer, or improve-answer" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in AI generate questions API:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
