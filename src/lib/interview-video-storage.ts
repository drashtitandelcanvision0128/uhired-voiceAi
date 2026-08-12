import { mkdir, readdir, readFile, stat, unlink, writeFile, access } from "fs/promises";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

const RETENTION_DAYS = 30;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

type UploadInput = {
  sessionId: string;
  buffer: Buffer;
  mimeType: string;
  sizeBytes: number;
  durationSec: number | null;
};

type VideoMeta = {
  mimeType: string | null;
  sizeBytes: number;
  durationSec: number | null;
  updatedAt: string;
  ext: "webm" | "mp4";
};

type StorageProvider = "s3" | "supabase" | "local";

export type InterviewVideoInfo = {
  videoFilePath: string | null;
  videoDurationSec: number | null;
  videoUploadedAt: string | null;
  videoRecordingStatus: "AVAILABLE" | "NOT_UPLOADED";
};

function getVideoExt(mimeType: string): "webm" | "mp4" {
  return mimeType.includes("webm") ? "webm" : "mp4";
}

function getLocalVideosDir() {
  return path.join(process.cwd(), "public", "interview-videos");
}

type S3StorageConfig = {
  bucket: string;
  client: S3Client;
};

type SupabaseStorageConfig = {
  bucket: string;
  client: ReturnType<typeof createClient>;
};

let cachedS3StorageConfig: S3StorageConfig | null | undefined;
let cachedSupabaseStorageConfig: SupabaseStorageConfig | null | undefined;

function buildS3StorageConfig(): S3StorageConfig | null {
  const region = env.awsRegion;
  const bucket = env.awsS3Bucket;
  const accessKeyId = env.awsAccessKeyId;
  const secretAccessKey = env.awsSecretAccessKey;
  const endpoint = env.awsS3Endpoint;

  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    console.log("[Video Storage] S3 not configured:", {
      region: !!region,
      bucket: !!bucket,
      accessKeyId: !!accessKeyId,
      secretAccessKey: !!secretAccessKey,
    });
    return null;
  }

  console.log("[Video Storage] S3 configured:", { region, bucket, endpoint: endpoint || "default" });
  return {
    bucket,
    client: new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: endpoint ? true : undefined,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    }),
  };
}

export function getS3StorageConfig(): S3StorageConfig | null {
  if (cachedS3StorageConfig === undefined) {
    cachedS3StorageConfig = buildS3StorageConfig();
  }
  return cachedS3StorageConfig;
}

function buildSupabaseStorageConfig(): SupabaseStorageConfig | null {
  const url = env.supabaseUrl;
  const serviceRoleKey = env.supabaseServiceRoleKey;
  const bucket = env.supabaseStorageBucket;

  if (!url || !serviceRoleKey) return null;

  return {
    bucket,
    client: createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }),
  };
}

function getSupabaseStorageConfig(): SupabaseStorageConfig | null {
  if (cachedSupabaseStorageConfig === undefined) {
    cachedSupabaseStorageConfig = buildSupabaseStorageConfig();
  }
  return cachedSupabaseStorageConfig;
}

function getPreferredProviderOrder(): StorageProvider[] {
  const explicit = env.videoStorageProvider.toLowerCase();
  if (explicit === "s3") return ["s3", "supabase", "local"];
  if (explicit === "supabase") return ["supabase", "s3", "local"];
  if (explicit === "local") return ["local", "s3", "supabase"];
  return ["s3", "supabase", "local"];
}

async function cleanupOldLocalVideoFiles(videosDir: string) {
  const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const files = await readdir(videosDir);
  await Promise.all(
    files.map(async (name) => {
      const filePath = path.join(videosDir, name);
      const fileStat = await stat(filePath).catch(() => null);
      if (!fileStat || !fileStat.isFile()) return;
      if (fileStat.mtimeMs >= cutoffMs) return;
      if (!name.endsWith(".webm") && !name.endsWith(".mp4") && !name.endsWith(".json")) return;
      await unlink(filePath).catch(() => undefined);
    }),
  );
}

async function createSignedUrlForFirstExistingObject(
  sessionId: string,
  extHint?: "webm" | "mp4" | null,
): Promise<string | null> {
  const supabase = getSupabaseStorageConfig();
  if (!supabase) return null;

  const candidates = [extHint, "webm", "mp4"].filter(
    (ext, index, arr): ext is "webm" | "mp4" => !!ext && arr.indexOf(ext) === index,
  );

  for (const ext of candidates) {
    const objectPath = `${sessionId}.${ext}`;
    const { data, error } = await supabase.client.storage
      .from(supabase.bucket)
      .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);
    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  }

  return null;
}

async function createS3SignedUrlForFirstExistingObject(
  sessionId: string,
  extHint?: "webm" | "mp4" | null,
): Promise<string | null> {
  const s3 = getS3StorageConfig();
  if (!s3) return null;

  const candidates = [extHint, "webm", "mp4"].filter(
    (ext, index, arr): ext is "webm" | "mp4" => !!ext && arr.indexOf(ext) === index,
  );

  for (const ext of candidates) {
    const key = `${sessionId}.${ext}`;
    try {
      await s3.client.send(new HeadObjectCommand({ Bucket: s3.bucket, Key: key }));
      return await getSignedUrl(
        s3.client,
        new GetObjectCommand({ Bucket: s3.bucket, Key: key }),
        { expiresIn: SIGNED_URL_TTL_SECONDS },
      );
    } catch {
      // Try next extension candidate
    }
  }

  return null;
}

export async function uploadInterviewVideo(input: UploadInput): Promise<{ videoFilePath: string | null }> {
  const { sessionId, buffer, mimeType, sizeBytes, durationSec } = input;
  const ext = getVideoExt(mimeType);
  const nowIso = new Date().toISOString();
  const meta: VideoMeta = {
    mimeType: mimeType || null,
    sizeBytes,
    durationSec,
    updatedAt: nowIso,
    ext,
  };

  const providerOrder = getPreferredProviderOrder();
  console.log(`[Video Storage] Upload for session ${sessionId}, provider order:`, providerOrder, `size: ${sizeBytes} bytes`);

  if (providerOrder[0] === "s3") {
    const s3 = getS3StorageConfig();
    if (s3) {
      try {
        const videoPath = `${sessionId}.${ext}`;
        const metaPath = `${sessionId}.json`;

        console.log(`[Video Storage] Uploading to S3: ${videoPath}`);
        await s3.client.send(
          new PutObjectCommand({
            Bucket: s3.bucket,
            Key: videoPath,
            Body: buffer,
            ContentType: mimeType || `video/${ext}`,
          }),
        );

        await s3.client.send(
          new PutObjectCommand({
            Bucket: s3.bucket,
            Key: metaPath,
            Body: JSON.stringify(meta),
            ContentType: "application/json",
          }),
        );

        const videoFilePath = await createS3SignedUrlForFirstExistingObject(sessionId, ext);
        console.log(`[Video Storage] S3 upload successful for session ${sessionId}:`, videoFilePath);
        return { videoFilePath };
      } catch (error) {
        console.error(`[Video Storage] S3 upload failed for session ${sessionId}, falling back to next provider:`, error);
        // Fall through to next provider instead of throwing
      }
    }
  }

  const supabase = getSupabaseStorageConfig();
  if (supabase && providerOrder.includes("supabase")) {
    try {
      const videoPath = `${sessionId}.${ext}`;
      const metaPath = `${sessionId}.json`;

      console.log(`[Video Storage] Uploading to Supabase: ${videoPath}`);
      const uploadVideo = await supabase.client.storage.from(supabase.bucket).upload(videoPath, buffer, {
        upsert: true,
        contentType: mimeType || `video/${ext}`,
      });
      if (uploadVideo.error) {
        console.error(`[Video Storage] Supabase video upload failed:`, uploadVideo.error);
        throw new Error("Unable to upload interview recording.");
      }

      const uploadMeta = await supabase.client.storage
        .from(supabase.bucket)
        .upload(metaPath, JSON.stringify(meta), {
          upsert: true,
          contentType: "application/json",
        });
      if (uploadMeta.error) {
        console.error(`[Video Storage] Supabase metadata upload failed:`, uploadMeta.error);
        throw new Error("Unable to save recording metadata.");
      }

      const videoFilePath = await createSignedUrlForFirstExistingObject(sessionId, ext);
      console.log(`[Video Storage] Supabase upload successful for session ${sessionId}:`, videoFilePath);
      return { videoFilePath };
    } catch (error) {
      console.error(`[Video Storage] Supabase upload failed for session ${sessionId}, falling back to local storage:`, error);
      // Fall through to local storage instead of throwing
    }
  }

  console.log(`[Video Storage] Falling back to local storage for session ${sessionId}`);
  const videosDir = getLocalVideosDir();
  await mkdir(videosDir, { recursive: true });
  const filename = `${sessionId}.${ext}`;
  const filePath = path.join(videosDir, filename);
  await writeFile(filePath, buffer);

  const metaPath = path.join(videosDir, `${sessionId}.json`);
  await writeFile(metaPath, JSON.stringify(meta), "utf8");
  await cleanupOldLocalVideoFiles(videosDir).catch(() => undefined);

  console.log(`[Video Storage] Local storage successful for session ${sessionId}:`, `/interview-videos/${filename}`);
  return { videoFilePath: `/interview-videos/${filename}` };
}

async function s3VideoObjectExists(sessionId: string, extHint?: "webm" | "mp4" | null): Promise<boolean> {
  const s3 = getS3StorageConfig();
  if (!s3) return false;

  const candidates = [extHint, "webm", "mp4"].filter(
    (ext, index, arr): ext is "webm" | "mp4" => !!ext && arr.indexOf(ext) === index,
  );

  for (const ext of candidates) {
    try {
      await s3.client.send(new HeadObjectCommand({ Bucket: s3.bucket, Key: `${sessionId}.${ext}` }));
      return true;
    } catch {
      // Try next extension candidate
    }
  }

  return false;
}

async function supabaseVideoObjectExists(sessionId: string, extHint?: "webm" | "mp4" | null): Promise<boolean> {
  const supabase = getSupabaseStorageConfig();
  if (!supabase) return false;

  const candidates = [extHint, "webm", "mp4"].filter(
    (ext, index, arr): ext is "webm" | "mp4" => !!ext && arr.indexOf(ext) === index,
  );

  for (const ext of candidates) {
    const objectPath = `${sessionId}.${ext}`;
    const { data, error } = await supabase.client.storage
      .from(supabase.bucket)
      .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);
    if (!error && data?.signedUrl) return true;
  }

  return false;
}

async function localVideoObjectExists(sessionId: string): Promise<boolean> {
  const videosDir = getLocalVideosDir();
  for (const ext of ["webm", "mp4"] as const) {
    try {
      await access(path.join(videosDir, `${sessionId}.${ext}`));
      return true;
    } catch {
      // Try next extension candidate
    }
  }
  return false;
}

export async function interviewVideoExists(sessionId: string): Promise<boolean> {
  if (await s3VideoObjectExists(sessionId)) return true;
  if (await supabaseVideoObjectExists(sessionId)) return true;
  return localVideoObjectExists(sessionId);
}

export async function getInterviewVideoRecordingStatuses(
  sessionIds: string[],
): Promise<Map<string, "AVAILABLE" | "NOT_UPLOADED">> {
  const uniqueIds = [...new Set(sessionIds)];
  const entries = await Promise.all(
    uniqueIds.map(async (sessionId) => {
      const exists = await interviewVideoExists(sessionId);
      return [sessionId, exists ? "AVAILABLE" : "NOT_UPLOADED"] as const;
    }),
  );
  return new Map(entries);
}

export async function getInterviewVideoInfo(sessionId: string): Promise<InterviewVideoInfo> {
  const s3 = getS3StorageConfig();
  if (s3) {
    let videoDurationSec: number | null = null;
    let videoUploadedAt: string | null = null;
    let extHint: "webm" | "mp4" | null = null;

    try {
      const metaObject = await s3.client.send(
        new GetObjectCommand({ Bucket: s3.bucket, Key: `${sessionId}.json` }),
      );
      if (metaObject.Body) {
        const metaRaw = await metaObject.Body.transformToString();
        const meta = JSON.parse(metaRaw) as Partial<VideoMeta>;
        videoDurationSec = typeof meta.durationSec === "number" ? meta.durationSec : null;
        videoUploadedAt = typeof meta.updatedAt === "string" ? meta.updatedAt : null;
        if (meta.ext === "webm" || meta.ext === "mp4") extHint = meta.ext;
        else if (typeof meta.mimeType === "string") extHint = getVideoExt(meta.mimeType);
      }
    } catch {
      // metadata may not exist for old files
    }

    const videoFilePath = await createS3SignedUrlForFirstExistingObject(sessionId, extHint);
    if (videoFilePath) {
      return {
        videoFilePath,
        videoDurationSec,
        videoUploadedAt,
        videoRecordingStatus: "AVAILABLE",
      };
    }
  }

  const supabase = getSupabaseStorageConfig();
  if (supabase) {
    let videoDurationSec: number | null = null;
    let videoUploadedAt: string | null = null;
    let extHint: "webm" | "mp4" | null = null;

    const metaDownload = await supabase.client.storage.from(supabase.bucket).download(`${sessionId}.json`);
    if (!metaDownload.error && metaDownload.data) {
      try {
        const metaRaw = await metaDownload.data.text();
        const meta = JSON.parse(metaRaw) as Partial<VideoMeta>;
        videoDurationSec = typeof meta.durationSec === "number" ? meta.durationSec : null;
        videoUploadedAt = typeof meta.updatedAt === "string" ? meta.updatedAt : null;
        if (meta.ext === "webm" || meta.ext === "mp4") extHint = meta.ext;
        else if (typeof meta.mimeType === "string") extHint = getVideoExt(meta.mimeType);
      } catch {
        // Ignore malformed metadata and still attempt URL generation.
      }
    }

    const videoFilePath = await createSignedUrlForFirstExistingObject(sessionId, extHint);
    if (videoFilePath) {
      return {
        videoFilePath,
        videoDurationSec,
        videoUploadedAt,
        videoRecordingStatus: "AVAILABLE",
      };
    }
  }

  const videosDir = getLocalVideosDir();
  const webmPath = path.join(videosDir, `${sessionId}.webm`);
  const mp4Path = path.join(videosDir, `${sessionId}.mp4`);
  const metaPath = path.join(videosDir, `${sessionId}.json`);
  let videoFilePath: string | null = null;
  let videoDurationSec: number | null = null;
  let videoUploadedAt: string | null = null;

  try {
    await access(webmPath);
    videoFilePath = `/interview-videos/${sessionId}.webm`;
  } catch {
    try {
      await access(mp4Path);
      videoFilePath = `/interview-videos/${sessionId}.mp4`;
    } catch {
      videoFilePath = null;
    }
  }

  try {
    const metaRaw = await readFile(metaPath, "utf8");
    const meta = JSON.parse(metaRaw) as { durationSec?: number | null; updatedAt?: string | null };
    videoDurationSec = typeof meta.durationSec === "number" ? meta.durationSec : null;
    videoUploadedAt = typeof meta.updatedAt === "string" ? meta.updatedAt : null;
  } catch {
    videoDurationSec = null;
    videoUploadedAt = null;
  }

  return {
    videoFilePath,
    videoDurationSec,
    videoUploadedAt,
    videoRecordingStatus: videoFilePath ? "AVAILABLE" : "NOT_UPLOADED",
  };
}

export async function deleteInterviewVideoAssets(sessionId: string): Promise<void> {
  const s3 = getS3StorageConfig();
  if (s3) {
    await Promise.all([
      s3.client
        .send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: `${sessionId}.webm` }))
        .catch(() => undefined),
      s3.client
        .send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: `${sessionId}.mp4` }))
        .catch(() => undefined),
      s3.client
        .send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: `${sessionId}.json` }))
        .catch(() => undefined),
    ]);
  }

  const supabase = getSupabaseStorageConfig();
  if (supabase) {
    await supabase.client.storage.from(supabase.bucket).remove([
      `${sessionId}.webm`,
      `${sessionId}.mp4`,
      `${sessionId}.json`,
    ]);
  }

  const videosDir = getLocalVideosDir();
  await Promise.all([
    unlink(path.join(videosDir, `${sessionId}.webm`)).catch(() => undefined),
    unlink(path.join(videosDir, `${sessionId}.mp4`)).catch(() => undefined),
    unlink(path.join(videosDir, `${sessionId}.json`)).catch(() => undefined),
  ]);
}
