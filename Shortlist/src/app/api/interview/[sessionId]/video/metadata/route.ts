import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getS3StorageConfig } from "@/lib/interview-video-storage";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  getCandidateInterviewSessionFromCookieHeader,
  isCandidateInterviewSessionGuardEnabled,
} from "@/lib/candidate-interview-auth";

type Context = {
  params: Promise<{ sessionId: string }>;
};

type VideoMeta = {
  mimeType: string | null;
  sizeBytes: number;
  durationSec: number | null;
  updatedAt: string;
  ext: "webm" | "mp4";
};

export async function POST(request: Request, context: Context) {
  const { sessionId } = await context.params;

  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    select: { id: true, sessionType: true, status: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }
  if (isCandidateInterviewSessionGuardEnabled()) {
    const candidateSession = getCandidateInterviewSessionFromCookieHeader(request.headers.get("cookie"));
    if (!candidateSession || candidateSession.sessionId !== sessionId) {
      return NextResponse.json({ error: "Unauthorized interview session access." }, { status: 401 });
    }
  }
  if (session.sessionType !== "COMPANY") {
    return NextResponse.json({ error: "Video upload is supported only for company sessions." }, { status: 400 });
  }

  const body = await request.json();
  const { mimeType, sizeBytes, durationSec } = body as {
    mimeType?: string;
    sizeBytes?: number;
    durationSec?: number;
  };

  if (!mimeType || typeof mimeType !== "string") {
    return NextResponse.json({ error: "Missing mimeType." }, { status: 400 });
  }
  if (!sizeBytes || typeof sizeBytes !== "number" || sizeBytes <= 0) {
    return NextResponse.json({ error: "Missing or invalid sizeBytes." }, { status: 400 });
  }

  const s3 = getS3StorageConfig();
  if (!s3) {
    return NextResponse.json({ error: "S3 storage not configured." }, { status: 500 });
  }

  const ext = mimeType.includes("webm") ? "webm" : "mp4";
  const nowIso = new Date().toISOString();
  const meta: VideoMeta = {
    mimeType: mimeType || null,
    sizeBytes,
    durationSec: durationSec || null,
    updatedAt: nowIso,
    ext,
  };

  const metaPath = `${sessionId}.json`;

  try {
    await s3.client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: metaPath,
        Body: JSON.stringify(meta),
        ContentType: "application/json",
      }),
    );

    console.log(`[Video Metadata] Metadata updated for session ${sessionId}`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`[Video Metadata] Failed to update metadata for session ${sessionId}:`, error);
    return NextResponse.json({ error: "Unable to save video metadata." }, { status: 500 });
  }
}
