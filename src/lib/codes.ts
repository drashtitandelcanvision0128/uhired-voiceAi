const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateAccessCode(prefix = "INT"): string {
  let token = "";
  for (let index = 0; index < 6; index += 1) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${prefix}-${token}`;
}
