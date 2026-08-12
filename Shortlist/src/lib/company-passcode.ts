import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SCRYPT_KEY_LEN = 64;

/** scrypt hash format: `{salt}:{hash}` */
export function isCompanyPasscodeHash(stored: string) {
  const parts = stored.split(":");
  return parts.length === 2 && parts[0]!.length >= 16 && parts[1]!.length >= 32;
}

export function hashCompanyPasscode(passcode: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(passcode, salt, SCRYPT_KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyCompanyPasscode(passcode: string, stored: string) {
  const submitted = passcode.trim();
  if (!submitted || !stored) return false;

  if (!isCompanyPasscodeHash(stored)) {
    return submitted === stored;
  }

  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const derived = scryptSync(submitted, salt, SCRYPT_KEY_LEN).toString("hex");
  const storedBuf = Buffer.from(hash, "hex");
  const derivedBuf = Buffer.from(derived, "hex");
  return storedBuf.length === derivedBuf.length && timingSafeEqual(storedBuf, derivedBuf);
}

export function needsPasscodeRehash(stored: string) {
  return !isCompanyPasscodeHash(stored);
}
