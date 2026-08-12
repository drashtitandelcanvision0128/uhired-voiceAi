import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadInterviewVideo } from "@/lib/interview-video-storage";
import {
  getCandidateInterviewSessionFromCookieHeader,
  isCandidateInterviewSessionGuardEnabled,
} from "@/lib/candidate-interview-auth";

type Context = {
  params: Promise<{ sessionId: string }>;
};

const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024;
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
  // Allow uploads even after completion so background recording flush can finish.

  const formData = await request.formData();
  const video = formData.get("video");
  const durationRaw = Number(formData.get("durationSec") ?? 0);
  const durationSec = Number.isFinite(durationRaw) ? Math.max(0, Math.round(durationRaw)) : 0;

  if (!(video instanceof File)) {
    return NextResponse.json({ error: "Missing video file." }, { status: 400 });
  }
  if (video.size === 0) {
    return NextResponse.json({ error: "Video file is empty." }, { status: 400 });
  }
  if (video.size > MAX_VIDEO_SIZE_BYTES) {
    return NextResponse.json({ error: "Video file exceeds 200MB upload limit." }, { status: 413 });
  }

  const arrayBuffer = await video.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  try {
    const uploadResult = await uploadInterviewVideo({
      sessionId,
      buffer,
      mimeType: video.type || "video/webm",
      sizeBytes: video.size,
      durationSec: durationSec || null,
    });
    console.log(`[Video Upload] Success for session ${sessionId}:`, uploadResult.videoFilePath);
    return NextResponse.json({ ok: true, videoFilePath: uploadResult.videoFilePath });
  } catch (error) {
    console.error(`[Video Upload] Failed for session ${sessionId}:`, error);
    return NextResponse.json({ error: "Unable to save interview recording." }, { status: 500 });
  }
}
