"use client";

import type { FaceDetector } from "@mediapipe/tasks-vision";

const MEDIAPIPE_VERSION = "0.10.35";
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite";

/** Minimum model confidence for a face to count as present. */
export const FACE_DETECTION_MIN_CONFIDENCE = 0.55;
/** Face bounding box must cover at least this fraction of the frame area. */
export const FACE_MIN_AREA_RATIO = 0.012;
/**
 * Covered-lens heuristic: both very dark and very flat (uniform) pixels.
 * Uses AND so dark rooms with visible faces are not flagged.
 */
export const COVERED_FRAME_DARK_MEAN = 18;
export const COVERED_FRAME_FLAT_VARIANCE = 18;

export type CandidateVisibilityState = {
  obscured: boolean;
  faceDetectorReady: boolean;
  facePresent: boolean;
  frameCovered: boolean;
};

let detectorPromise: Promise<FaceDetector | null> | null = null;
let faceDetectionTimestamp = 0;

export function preloadFaceDetector(): void {
  void ensureFaceDetector();
}

export async function ensureFaceDetector(): Promise<FaceDetector | null> {
  if (typeof window === "undefined") return null;
  if (!detectorPromise) {
    detectorPromise = initFaceDetector().catch((error) => {
      console.warn("[face-detection] Failed to initialize:", error);
      detectorPromise = null;
      return null;
    });
  }
  return detectorPromise;
}

async function initFaceDetector(): Promise<FaceDetector | null> {
  const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE);

  for (const delegate of ["GPU", "CPU"] as const) {
    try {
      return await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_MODEL_URL,
          delegate,
        },
        runningMode: "VIDEO",
        minDetectionConfidence: FACE_DETECTION_MIN_CONFIDENCE,
      });
    } catch (error) {
      if (delegate === "CPU") throw error;
      console.warn("[face-detection] GPU delegate failed, trying CPU:", error);
    }
  }

  return null;
}

/**
 * Detects a physically covered or blank lens. Requires both very low luminance
 * and very low variance so normal low-light scenes are not flagged.
 */
export function isFrameCovered(video: HTMLVideoElement, canvas: HTMLCanvasElement): boolean {
  const w = 32;
  const h = 24;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;

  try {
    ctx.drawImage(video, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const count = data.length / 4;
    if (count === 0) return false;

    let sum = 0;
    const lums = new Float32Array(count);
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      lums[p] = lum;
      sum += lum;
    }

    const mean = sum / count;
    let varSum = 0;
    for (let p = 0; p < count; p += 1) {
      const diff = lums[p]! - mean;
      varSum += diff * diff;
    }
    const variance = varSum / count;

    return mean < COVERED_FRAME_DARK_MEAN && variance < COVERED_FRAME_FLAT_VARIANCE;
  } catch {
    return false;
  }
}

function detectFaceInFrame(detector: FaceDetector, video: HTMLVideoElement): boolean {
  faceDetectionTimestamp += 1;
  const result = detector.detectForVideo(video, faceDetectionTimestamp);
  const frameArea = video.videoWidth * video.videoHeight;
  if (frameArea <= 0) return false;

  for (const detection of result.detections) {
    const score = detection.categories[0]?.score ?? 0;
    if (score < FACE_DETECTION_MIN_CONFIDENCE) continue;

    const box = detection.boundingBox;
    if (!box) continue;

    const faceArea = box.width * box.height;
    if (faceArea / frameArea >= FACE_MIN_AREA_RATIO) return true;
  }

  return false;
}

export async function evaluateCandidateVisibility(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Promise<CandidateVisibilityState> {
  const frameCovered = isFrameCovered(video, canvas);
  const detector = await ensureFaceDetector();
  const faceDetectorReady = detector !== null;

  let facePresent = true;
  if (detector) {
    try {
      facePresent = detectFaceInFrame(detector, video);
    } catch {
      // Never block the interview when detection throws on a single frame.
      facePresent = true;
    }
  }

  const obscured = frameCovered || (faceDetectorReady && !facePresent);

  return { obscured, faceDetectorReady, facePresent, frameCovered };
}
