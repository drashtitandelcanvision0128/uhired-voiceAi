import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

const PREFIX = "enc:v1:";

function getEncryptionKey(): Buffer | null {
  const raw = env.fieldEncryptionKey;
  if (!raw) return null;
  if (/^[A-Fa-f0-9]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return createHash("sha256").update(raw, "utf8").digest();
}

export function isFieldEncryptionEnabled(): boolean {
  return getEncryptionKey() !== null;
}

export function encryptField(plaintext: string | null | undefined): string | null {
  if (!plaintext) return plaintext ?? null;
  const key = getEncryptionKey();
  if (!key) return plaintext;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString("base64url");
  return `${PREFIX}${payload}`;
}

export function decryptField(stored: string | null | undefined): string | null {
  if (!stored) return stored ?? null;
  if (!stored.startsWith(PREFIX)) return stored;

  const key = getEncryptionKey();
  if (!key) return stored;

  const raw = stored.slice(PREFIX.length);
  const bytes = Buffer.from(raw, "base64url");
  if (bytes.length < 28) return stored;

  const iv = bytes.subarray(0, 12);
  const tag = bytes.subarray(12, 28);
  const encrypted = bytes.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function protectEmail(email: string | null | undefined): string | null {
  if (!email) return email ?? null;
  return encryptField(email.trim().toLowerCase()) ?? null;
}

export function revealEmail(stored: string | null | undefined): string | null {
  return decryptField(stored);
}
