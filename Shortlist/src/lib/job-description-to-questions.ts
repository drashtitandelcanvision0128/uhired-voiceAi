import OpenAI from "openai";
import { env } from "@/lib/env";

const openai = new OpenAI({
  apiKey: env.openAiApiKey,
});

export interface GeneratedQuestion {
  prompt: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  expectedAnswer?: string;
}

export interface JobDescriptionQuestionsInput {
  jobDescription: string;
  positionTitle?: string;
  domain?: string;
  keySkills?: string[];
  questionCount?: number;
}

/**
 * Converts a job description into relevant interview questions using AI
 * Similar to interviewsby.ai functionality
 */
export async function generateQuestionsFromJobDescription(
  input: JobDescriptionQuestionsInput
): Promise<GeneratedQuestion[]> {
  const {
    jobDescription,
    positionTitle = "General Role",
    domain = "General",
    keySkills = [],
    questionCount = 8,
  } = input;

  const technicalMin = Math.max(1, Math.ceil(questionCount * 0.6));
  const behavioralMax = Math.max(0, questionCount - technicalMin);
  const roleLabel = positionTitle.trim() || "General Role";
  const isNonTechnicalRole =
    /\b(hr|human resources|recruit|recruiter|people operations|talent acquisition|marketing|sales|finance|accounting|legal|nurse|teacher|chef|pilot)\b/i.test(
      roleLabel,
    ) &&
    !/\b(software|developer|engineer|programmer|devops|data scientist|architect)\b/i.test(roleLabel);

  const systemPrompt = isNonTechnicalRole
    ? `You are an expert hiring manager creating role-specific interview questions for a non-technical role.

Generate questions that:
1. Are DIRECTLY tied to the position title, job description, and key skills — reference specific responsibilities, tools, and outcomes from the JD
2. Include at least ${technicalMin} ROLE-SPECIFIC or hands-on EXPERIENCE questions that test domain knowledge, judgment, stakeholder management, or day-to-day responsibilities for THIS role (not generic prompts)
3. Include at most ${behavioralMax} behavioral or situational questions (STAR method) — only where they test competencies explicitly required by the JD
4. Cover different difficulty levels (easy, medium, hard)
5. Are specific and actionable — avoid vague questions like "tell me about yourself"
6. Do NOT ask software engineering, coding, algorithms, or IT technical questions unless the JD explicitly requires them

Return JSON with a "questions" array. Each item:
- prompt: The interview question (spoken aloud)
- category: "Technical", "Experience", "Behavioral", or "Situational"
- difficulty: "easy", "medium", or "hard"
- expectedAnswer: Brief outline of a strong answer`
    : `You are an expert technical hiring manager creating role-specific interview questions.

Generate questions that:
1. Are DIRECTLY tied to the position title, job description, and key skills — reference specific tools, responsibilities, and outcomes from the JD
2. Include at least ${technicalMin} TECHNICAL or hands-on EXPERIENCE questions that test domain knowledge, architecture, tools, debugging, or problem-solving for THIS role (not generic prompts)
3. Include at most ${behavioralMax} behavioral or situational questions (STAR method) — only where they test competencies explicitly required by the JD
4. Cover different difficulty levels (easy, medium, hard)
5. Are specific and actionable — avoid vague questions like "tell me about yourself" or "how do you handle conflict" unless the role is primarily non-technical
6. Would help identify the best candidates for this exact role
7. Do NOT ask about workflow automation platforms (N8N, Zapier, Make.com) or messaging-bot automation unless explicitly listed in the key skills or job description

Return JSON with a "questions" array. Each item:
- prompt: The interview question (spoken aloud)
- category: "Technical", "Experience", "Behavioral", or "Situational"
- difficulty: "easy", "medium", or "hard"
- expectedAnswer: Brief outline of a strong answer`;

  const userPrompt = `Generate exactly ${questionCount} interview questions for this role.

Position Title: ${positionTitle}
Domain: ${domain}
Key Skills (must be covered in technical/experience questions): ${keySkills.join(", ") || "Derive from job description"}

Job Description:
${jobDescription}

Requirements:
- At least ${technicalMin} questions must be category "Technical" or "Experience"
- At most ${behavioralMax} questions may be "Behavioral" or "Situational"
- Every question must be role-specific — mention technologies, practices, or outcomes from the JD where relevant${
    isNonTechnicalRole
      ? "\n- Do NOT ask software engineering, coding, or IT technical questions unless explicitly required by the JD"
      : "\n- Do NOT ask about workflow automation tools (N8N, Zapier, WhatsApp/Telegram bots) unless they appear in the key skills or job description"
  }`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in AI response");
    }

    const parsed = JSON.parse(content);
    
    // Handle different response formats
    const questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
    
    return questions.map((q: any) => ({
      prompt: q.prompt || q.question || "",
      category: q.category || "General",
      difficulty: q.difficulty || "medium",
      expectedAnswer: q.expectedAnswer || q.idealAnswer || undefined,
    }));
  } catch (error) {
    console.error("Error generating questions from job description:", error);
    throw new Error("Failed to generate questions from job description");
  }
}

/**
 * Generates sample answers for interview questions
 * Similar to interviewsby.ai's sample response feature
 */
export async function generateSampleAnswer(
  question: string,
  jobDescription?: string,
  domain?: string
): Promise<string> {
  const systemPrompt = `You are an expert career coach and interview preparation specialist. Your task is to provide a high-quality sample answer to an interview question.

The sample answer should:
1. Be realistic and natural
2. Demonstrate best practices (STAR method for behavioral questions)
3. Show specific examples and achievements
4. Be concise but comprehensive
5. Highlight relevant skills and experience
6. Be tailored to the specific role if context is provided`;

  const userPrompt = jobDescription
    ? `Question: ${question}

Context:
Domain: ${domain || "General"}
Job Description: ${jobDescription}

Provide a strong sample answer that would impress an interviewer for this specific role.`
    : `Question: ${question}

Provide a strong sample answer that would impress an interviewer.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || "Unable to generate sample answer.";
  } catch (error) {
    console.error("Error generating sample answer:", error);
    throw new Error("Failed to generate sample answer");
  }
}

/**
 * Improves a candidate's answer with AI feedback
 * Similar to interviewsby.ai's feedback feature
 */
export interface AnswerFeedback {
  score: number;
  strengths: string[];
  improvements: string[];
  improvedAnswer: string;
  feedback: string;
}

export async function improveAnswer(
  question: string,
  candidateAnswer: string,
  jobDescription?: string,
  domain?: string
): Promise<AnswerFeedback> {
  const systemPrompt = `You are an expert interviewer and career coach. Your task is to evaluate a candidate's interview answer and provide constructive feedback.

Your evaluation should:
1. Score the answer from 0-100
2. Identify specific strengths
3. Provide actionable improvements
4. Suggest an improved version of the answer
5. Give overall feedback

Return your response as a JSON object with:
- score: number (0-100)
- strengths: array of strings
- improvements: array of strings  
- improvedAnswer: string
- feedback: string (overall assessment)`;

  const userPrompt = jobDescription
    ? `Question: ${question}

Candidate's Answer: ${candidateAnswer}

Context:
Domain: ${domain || "General"}
Job Description: ${jobDescription}

Evaluate this answer and provide feedback.`
    : `Question: ${question}

Candidate's Answer: ${candidateAnswer}

Evaluate this answer and provide feedback.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content in AI response");
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("Error improving answer:", error);
    throw new Error("Failed to improve answer");
  }
}
