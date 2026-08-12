import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3StorageConfig } from "@/lib/interview-video-storage";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const FILE_NAME_RE = /^cms-[\w-]+\.(jpg|jpeg|png|webp|gif)$/i;

function extFromMime(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "bin";
}

export function getLocalCmsImagesDir() {
  return path.join(process.cwd(), "public", "cms-images");
}

export function isValidCmsImageFileName(fileName: string) {
  return FILE_NAME_RE.test(fileName);
}

export function cmsImagePublicPath(fileName: string) {
  return `/api/public/cms-images/${fileName}`;
}

export async function uploadCmsImage(buffer: Buffer, mimeType: string) {
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new Error("Unsupported image type. Use JPEG, PNG, WebP, or GIF.");
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error("Image must be under 5 MB.");
  }

  const ext = extFromMime(mimeType);
  const fileName = `cms-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const s3 = getS3StorageConfig();

  if (s3) {
    const key = `cms/${fileName}`;
    await s3.client.send(
      new PutObjectCommand({
        Bucket: s3.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    return { fileName, url: cmsImagePublicPath(fileName) };
  }

  const dir = getLocalCmsImagesDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), buffer);
  return { fileName, url: cmsImagePublicPath(fileName) };
}

export async function readCmsImage(fileName: string) {
  if (!isValidCmsImageFileName(fileName)) {
    return null;
  }

  const s3 = getS3StorageConfig();
  const key = `cms/${fileName}`;

  if (s3) {
    try {
      const response = await s3.client.send(
        new GetObjectCommand({ Bucket: s3.bucket, Key: key }),
      );
      const bytes = await response.Body?.transformToByteArray();
      if (!bytes) return null;
      return {
        buffer: Buffer.from(bytes),
        mimeType: response.ContentType || "image/jpeg",
      };
    } catch {
      // Fall through to local disk (dev hybrid setups).
    }
  }

  try {
    const buffer = await readFile(path.join(getLocalCmsImagesDir(), fileName));
    const ext = fileName.split(".").pop()?.toLowerCase();
    const mimeType =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : "image/jpeg";
    return { buffer, mimeType };
  } catch {
    return null;
  }
}
