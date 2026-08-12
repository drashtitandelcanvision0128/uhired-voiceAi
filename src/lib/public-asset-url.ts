/** Normalize cover image input before save (upload paths, absolute URLs, bare domains). */
export function normalizeCoverImageUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Resolve a stored asset URL for use in <img src> (fixes legacy https:/// corruption). */
export function resolvePublicAssetUrl(url: string | null | undefined) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const corrupted = trimmed.match(/^https?:\/\/(\/.+)$/i);
  if (corrupted) return corrupted[1];

  if (trimmed.startsWith("/")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
