import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getS3StorageConfig } from "@/lib/interview-video-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  getCandidateInterviewSessionFromCookieHeader,
  isCandidateInterviewSessionGuardEnabled,
} from "@/lib/candidate-interview-auth";

type Context = {
  params: Promise<{ sessionId: string }>;
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
  const { mimeType, sizeBytes } = body as { mimeType?: string; sizeBytes?: number };

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
  const key = `${sessionId}.${ext}`;

  try {
    const signedUrl = await getSignedUrl(
      s3.client,
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: key,
        ContentType: mimeType,
        ContentLength: sizeBytes,
      }),
      { expiresIn: 300 }, // 5 minutes
    );

    return NextResponse.json({
      uploadUrl: signedUrl,
      key,
      bucket: s3.bucket,
    });
  } catch (error) {
    console.error(`[Video Upload URL] Failed to generate presigned URL for session ${sessionId}:`, error);
    return NextResponse.json({ error: "Unable to generate upload URL." }, { status: 500 });
  }
}
