import OpenAI from "openai";
import { PrismaClient } from "@prisma/client";

const MAX_RETRIES = 3;

function toInt(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseScoreFromOutput(outputText, model) {
  const parsed = JSON.parse(outputText);
  const communication = toInt(parsed.communication);
  const domainDepth = toInt(parsed.domainDepth);
  const confidence = toInt(parsed.confidence);
  const overallScore = Math.round(communication * 0.35 + domainDepth * 0.4 + confidence * 0.25);

  const strengths = Array.isArray(parsed.strengths) ? parsed.strengths.map(String).slice(0, 5) : [];
  const improvements = Array.isArray(parsed.improvements) ? parsed.improvements.map(String).slice(0, 5) : [];
  const evidence = Array.isArray(parsed.evidence) ? parsed.evidence.map(String).slice(0, 6) : [];
  const summary = typeof parsed.summary === "string" && parsed.summary.trim()
    ? parsed.summary.trim().slice(0, 500)
    : "Rubric scoring completed.";

  return {
    overallScore,
    communication,
    domainDepth,
    confidence,
    summary,
    strengths,
    improvements,
    evidence,
    scoringMode: "rubric-batch",
    scoringModel: model || null,
  };
}

async function applyRetry(prisma, jobId, prevRetryCount, errorMessage) {
  const nextRetry = prevRetryCount + 1;
  const exhausted = nextRetry >= MAX_RETRIES;
  await prisma.scoringBatchJob.update({
    where: { id: jobId },
    data: {
      status: exhausted ? "FAILED" : "PENDING",
      batchId: exhausted ? undefined : null,
      retryCount: nextRetry,
      error: errorMessage.slice(0, 2000),
      completedAt: exhausted ? new Date() : null,
    },
  });
}

async function processCompletedBatch(client, prisma, batchId, scoringModel) {
  const jobs = await prisma.scoringBatchJob.findMany({
    where: { batchId, status: "SUBMITTED" },
    select: { id: true, retryCount: true, sessionId: true },
  });
  if (!jobs.length) return;

  const batch = await client.batches.retrieve(batchId);
  if (!batch.output_file_id) {
    for (const job of jobs) {
      await applyRetry(prisma, job.id, job.retryCount, "Batch completed without output file.");
    }
    return;
  }

  const outputResp = await client.files.content(batch.output_file_id);
  const outputText = await outputResp.text();
  const lineMap = new Map();
  for (const rawLine of outputText.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      const parsed = JSON.parse(line);
      if (parsed?.custom_id) {
        lineMap.set(String(parsed.custom_id), parsed);
      }
    } catch {
      // ignore malformed line
    }
  }

  for (const job of jobs) {
    const line = lineMap.get(job.id);
    if (!line) {
      await applyRetry(prisma, job.id, job.retryCount, "No batch output line found for job.");
      continue;
    }

    const statusCode = line?.response?.status_code;
    const output = line?.response?.body?.output_text;
    if (statusCode !== 200 || typeof output !== "string" || !output.trim()) {
      await applyRetry(
        prisma,
        job.id,
        job.retryCount,
        `Batch response invalid: status=${statusCode ?? "unknown"}`,
      );
      continue;
    }

    try {
      const score = parseScoreFromOutput(output, scoringModel);
      const existingScorecard = await prisma.scorecard.findUnique({
        where: { sessionId: job.sessionId },
        select: { accuracyPercent: true, questionResults: true },
      });
      const mergedScore = {
        ...score,
        ...(existingScorecard?.accuracyPercent != null
          ? { accuracyPercent: existingScorecard.accuracyPercent }
          : {}),
        ...(existingScorecard?.questionResults != null
          ? { questionResults: existingScorecard.questionResults }
          : {}),
        ...(existingScorecard?.accuracyPercent != null
          ? {
              overallScore: Math.round(
                existingScorecard.accuracyPercent * 0.8 + score.overallScore * 0.2,
              ),
            }
          : {}),
      };
      await prisma.$transaction(async (tx) => {
        await tx.scorecard.upsert({
          where: { sessionId: job.sessionId },
          update: mergedScore,
          create: { sessionId: job.sessionId, ...mergedScore },
        });
        await tx.scoringBatchJob.update({
          where: { id: job.id },
          data: {
            status: "COMPLETED",
            resultPayload: line,
            error: null,
            completedAt: new Date(),
          },
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to parse rubric score output.";
      await applyRetry(prisma, job.id, job.retryCount, message);
    }
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required.");
  }
  const prisma = new PrismaClient();
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const scoringModel = process.env.SCORING_MODEL || "gpt-4.1-mini";

  try {
    const submitted = await prisma.scoringBatchJob.findMany({
      where: { status: "SUBMITTED", batchId: { not: null } },
      select: { batchId: true },
      distinct: ["batchId"],
    });

    for (const entry of submitted) {
      const batchId = entry.batchId;
      if (!batchId) continue;

      const batch = await client.batches.retrieve(batchId);
      if (batch.status === "completed") {
        await processCompletedBatch(client, prisma, batchId, scoringModel);
        continue;
      }

      if (["failed", "cancelled", "expired"].includes(batch.status)) {
        const jobs = await prisma.scoringBatchJob.findMany({
          where: { batchId, status: "SUBMITTED" },
          select: { id: true, retryCount: true },
        });
        for (const job of jobs) {
          await applyRetry(
            prisma,
            job.id,
            job.retryCount,
            `Batch ended with status ${batch.status}.`,
          );
        }
      }
    }

    console.log("Batch scoring sync complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
