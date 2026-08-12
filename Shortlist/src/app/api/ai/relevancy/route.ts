import { NextResponse } from "next/server";
import {
  calculateResponseRelevancy,
  batchCalculateRelevancy,
  generateInterviewRelevancyReport,
} from "@/lib/response-relevancy";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    if (action === "calculate-relevancy") {
      const { question, answer, jobDescription, keySkills, domain } = params;
      
      if (!question || !answer) {
        return NextResponse.json(
          { error: "Question and answer are required" },
          { status: 400 }
        );
      }

      const relevancy = await calculateResponseRelevancy(question, answer, {
        jobDescription,
        keySkills,
        domain,
      });

      return NextResponse.json({ relevancy });
    }

    if (action === "batch-relevancy") {
      const { qaPairs, jobDescription, keySkills, domain } = params;
      
      if (!qaPairs || !Array.isArray(qaPairs)) {
        return NextResponse.json(
          { error: "qaPairs array is required" },
          { status: 400 }
        );
      }

      const relevancies = await batchCalculateRelevancy(qaPairs, {
        jobDescription,
        keySkills,
        domain,
      });

      return NextResponse.json({ relevancies });
    }

    if (action === "interview-report") {
      const { qaPairs, jobDescription, keySkills, domain } = params;
      
      if (!qaPairs || !Array.isArray(qaPairs)) {
        return NextResponse.json(
          { error: "qaPairs array is required" },
          { status: 400 }
        );
      }

      const report = await generateInterviewRelevancyReport(qaPairs, {
        jobDescription,
        keySkills,
        domain,
      });

      return NextResponse.json({ report });
    }

    return NextResponse.json(
      { error: "Invalid action. Use: calculate-relevancy, batch-relevancy, or interview-report" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error in AI relevancy API:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
