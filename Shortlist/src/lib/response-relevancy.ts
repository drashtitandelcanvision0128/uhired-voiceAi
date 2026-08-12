import OpenAI from "openai";
import { env } from "@/lib/env";

const openai = new OpenAI({
  apiKey: env.openAiApiKey,
});

export interface RelevancyScore {
  overallScore: number; // 0-100
  relevanceScore: number; // 0-100
  completenessScore: number; // 0-100
  clarityScore: number; // 0-100
  keyPointsCovered: string[];
  missingPoints: string[];
  feedback: string;
}

/**
 * Calculates response relevancy score similar to Interviewer.AI's Response Relevancy feature
 * This evaluates how well a candidate's answer addresses the question
 */
export async function calculateResponseRelevancy(
  question: string,
  answer: string,
  context?: {
    jobDescription?: string;
    keySkills?: string[];
    domain?: string;
  }
): Promise<RelevancyScore> {
  const systemPrompt = `You are an expert interviewer and evaluator. Your task is to evaluate the relevancy and quality of a candidate's answer to an interview question.

Evaluate the answer based on:
1. Relevance: How directly the answer addresses the question
2. Completeness: How thoroughly the answer covers the topic
3. Clarity: How clear and well-structured the answer is
4. Key Points: Important points that were covered
5. Missing Points: Important points that should have been covered but weren't

Return your response as a JSON object with:
- overallScore: number (0-100) - weighted average of all scores
- relevanceScore: number (0-100) - how relevant the answer is to the question
- completenessScore: number (0-100) - how complete the answer is
- clarityScore: number (0-100) - how clear and well-structured the answer is
- keyPointsCovered: array of strings - important points that were covered
- missingPoints: array of strings - important points that should have been covered
- feedback: string - overall feedback on the answer`;

  let userPrompt = `Question: ${question}

Candidate's Answer: ${answer}`;

  if (context) {
    userPrompt += `\n\nContext:`;
    if (context.jobDescription) {
      userPrompt += `\nJob Description: ${context.jobDescription}`;
    }
    if (context.keySkills && context.keySkills.length > 0) {
      userPrompt += `\nKey Skills: ${context.keySkills.join(", ")}`;
    }
    if (context.domain) {
      userPrompt += `\nDomain: ${context.domain}`;
    }
  }

  userPrompt += `\n\nEvaluate this answer and provide a detailed relevancy assessment.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in AI response");
    }

    const result = JSON.parse(content);
    
    // Ensure all required fields are present
    return {
      overallScore: result.overallScore || 50,
      relevanceScore: result.relevanceScore || 50,
      completenessScore: result.completenessScore || 50,
      clarityScore: result.clarityScore || 50,
      keyPointsCovered: result.keyPointsCovered || [],
      missingPoints: result.missingPoints || [],
      feedback: result.feedback || "No feedback provided",
    };
  } catch (error) {
    console.error("Error calculating response relevancy:", error);
    throw new Error("Failed to calculate response relevancy");
  }
}

/**
 * Batch calculate relevancy scores for multiple Q&A pairs
 * Useful for comprehensive interview evaluation
 */
export async function batchCalculateRelevancy(
  qaPairs: Array<{ question: string; answer: string }>,
  context?: {
    jobDescription?: string;
    keySkills?: string[];
    domain?: string;
  }
): Promise<RelevancyScore[]> {
  const results = await Promise.all(
    qaPairs.map((pair) =>
      calculateResponseRelevancy(pair.question, pair.answer, context)
    )
  );
  return results;
}

/**
 * Generate a comprehensive relevancy report for an entire interview
 * Similar to Interviewer.AI's comprehensive analytics
 */
export interface InterviewRelevancyReport {
  overallScore: number;
  questionScores: Array<{
    question: string;
    score: RelevancyScore;
  }>;
  strengths: string[];
  areasForImprovement: string[];
  summary: string;
}

export async function generateInterviewRelevancyReport(
  qaPairs: Array<{ question: string; answer: string }>,
  context?: {
    jobDescription?: string;
    keySkills?: string[];
    domain?: string;
  }
): Promise<InterviewRelevancyReport> {
  const scores = await batchCalculateRelevancy(qaPairs, context);
  
  // Calculate overall score as average of all question scores
  const overallScore = Math.round(
    scores.reduce((sum, score) => sum + score.overallScore, 0) / scores.length
  );

  // Identify strengths and areas for improvement
  const strengths: string[] = [];
  const areasForImprovement: string[] = [];

  scores.forEach((score, index) => {
    if (score.overallScore >= 75) {
      strengths.push(
        `Strong answer to question ${index + 1}: ${score.feedback}`
      );
    } else if (score.overallScore < 50) {
      areasForImprovement.push(
        `Question ${index + 1} needs improvement: ${score.feedback}`
      );
    }
  });

  // Generate summary
  const summary = `Overall interview performance score: ${overallScore}/100. 
    ${strengths.length > 0 ? `Strengths: ${strengths.length}.` : ''}
    ${areasForImprovement.length > 0 ? `Areas for improvement: ${areasForImprovement.length}.` : ''}`;

  return {
    overallScore,
    questionScores: qaPairs.map((pair, index) => ({
      question: pair.question,
      score: scores[index],
    })),
    strengths,
    areasForImprovement,
    summary,
  };
}
