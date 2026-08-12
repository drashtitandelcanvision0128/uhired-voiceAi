function randomBytesHex(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Opaque URL segment; 32 bytes hex (64 chars). */
export function generateRawScorecardShareToken() {
  return randomBytesHex(32);
}

function hexFromBuffer(buffer: ArrayBuffer) {
  const u8 = new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < u8.length; i++) {
    hex += u8[i]!.toString(16).padStart(2, "0");
  }
  return hex;
}

/** SHA-256 of UTF-8 token, lowercase hex (stored in DB). */
export async function hashRawScorecardShareToken(rawToken: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
  return hexFromBuffer(digest);
}
