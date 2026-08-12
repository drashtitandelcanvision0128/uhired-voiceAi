import { readFile } from "fs/promises";
import path from "path";

/** Optional PNG/JPG at COMPANY_LOGO_PATH or public/company-logo.png */
export async function readCompanyLogoBytes(): Promise<Uint8Array | null> {
  const candidates = [
    process.env.COMPANY_LOGO_PATH?.trim(),
    path.join(process.cwd(), "public", "company-logo.png"),
    path.join(process.cwd(), "public", "company-logo.jpg"),
  ].filter((p): p is string => Boolean(p));

  for (const filePath of candidates) {
    try {
      const buf = await readFile(filePath);
      if (buf.byteLength > 0) return new Uint8Array(buf);
    } catch {
      /* try next path */
    }
  }
  return null;
}
