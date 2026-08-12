import OpenAI from "openai";
import { PrismaClient } from "@prisma/client";
import { createReadStream } from "fs";
import fs from "fs/promises";
import os from "os";
import path from "path";

const MAX_RETRIES = 3;

function getScoringModel() {
  return process.env.SCORING_MODEL || "gpt-4.1-mini";
}

function buildTranscriptForScoring(turns) {
  const maxTurns = 120;
  return (turns || [])
    .slice(-maxTurns)
    .map((turn) => `${turn.speaker}: ${String(turn.message || "").trim()}`)
    .join("\n");
}

function buildRubricPrompt(input) {
  const transcript = buildTranscriptForScoring(input.turns || []);
  const skills = Array.isArray(input.keySkills) && input.keySkills.length ? input.keySkills.join(", ") : "Not provided";
  const mandatory = Array.isArray(input.mandatoryQuestions) && input.mandatoryQuestions.length
    ? input.mandatoryQuestions.map((q) => `- ${q}`).join("\n")
    : "Not provided";

  return [
    "You are an expert technical interview evaluator.",
    "Evaluate candidate performance from interview transcript using this rubric:",
    "- communication: clarity, structure, conciseness, listening response quality",
    "- domainDepth: technical correctness, depth, relevance, practical reasoning",
    "- confidence: ownership, decisiveness, composure, response control",
    "Scoring rules:",
    "- Scores must be integers between 0 and 100.",
    "- overallScore = round(communication*0.35 + domainDepth*0.4 + confidence*0.25).",
    "- summary must be 1-2 concise sentences grounded in observed answers.",
    "- strengths: 2-4 concise bullet phrases.",
    "- improvements: 2-4 concise bullet phrases.",
    "- evidence: 2-5 short transcript-grounded observations.",
    "",
    `Role: ${input.positionTitle ?? "Not provided"}`,
    `Domain: ${input.domain ?? "Not provided"}`,
    `Topic: ${input.topic ?? "Not provided"}`,
    `Key skills: ${skills}`,
    "Mandatory questions:",
    mandatory,
    "",
    "Interview transcript:",
    transcript || "No transcript available.",
    "",
    "Return ONLY valid JSON with keys: overallScore, communication, domainDepth, confidence, summary, strengths, improvements, evidence",
  ].join("\n");
}

function buildBatchLine(job) {
  const input = job.inputPayload;
  const model = input.scoringModel || getScoringModel();
  const prompt = buildRubricPrompt(input);
  return {
    custom_id: job.id,
    method: "POST",
    url: "/v1/responses",
    body: {
      model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: "You output strict JSON only." }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "interview_scorecard",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              overallScore: { type: "integer", minimum: 0, maximum: 100 },
              communication: { type: "integer", minimum: 0, maximum: 100 },
              domainDepth: { type: "integer", minimum: 0, maximum: 100 },
              confidence: { type: "integer", minimum: 0, maximum: 100 },
              summary: { type: "string", minLength: 10, maxLength: 500 },
              strengths: {
                type: "array",
                minItems: 2,
                maxItems: 5,
                items: { type: "string", minLength: 3, maxLength: 180 },
              },
              improvements: {
                type: "array",
                minItems: 2,
                maxItems: 5,
                items: { type: "string", minLength: 3, maxLength: 180 },
              },
              evidence: {
                type: "array",
                minItems: 1,
                maxItems: 6,
                items: { type: "string", minLength: 3, maxLength: 220 },
              },
            },
            required: [
              "overallScore",
              "communication",
              "domainDepth",
              "confidence",
              "summary",
              "strengths",
              "improvements",
              "evidence",
            ],
          },
        },
      },
    },
  };
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required.");
  }

  const prisma = new PrismaClient();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const jobs = await prisma.scoringBatchJob.findMany({
      where: {
        status: "PENDING",
        retryCount: { lt: MAX_RETRIES },
        batchId: null,
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    if (jobs.length === 0) {
      console.log("No pending scoring jobs found.");
      return;
    }

    const lines = jobs.map((job) => JSON.stringify(buildBatchLine(job))).join("\n");
    const tmpPath = path.join(os.tmpdir(), `scorecard-batch-${Date.now()}.jsonl`);
    await fs.writeFile(tmpPath, `${lines}\n`, "utf8");

    const file = await client.files.create({
      file: createReadStream(tmpPath),
      purpose: "batch",
    });

    const batch = await client.batches.create({
      input_file_id: file.id,
      endpoint: "/v1/responses",
      completion_window: "24h",
      metadata: {
        job: "interview-scorecards",
        scoringModel: getScoringModel(),
      },
    });

    await prisma.scoringBatchJob.updateMany({
      where: { id: { in: jobs.map((job) => job.id) } },
      data: {
        status: "SUBMITTED",
        batchId: batch.id,
        submittedAt: new Date(),
        error: null,
      },
    });

    await fs.unlink(tmpPath).catch(() => undefined);
    console.log(JSON.stringify({ batchId: batch.id, inputFileId: file.id, jobs: jobs.length }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
