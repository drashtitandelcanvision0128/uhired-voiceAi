const promptCache = new Map<string, string>();
const MAX_CACHE_ENTRIES = 256;

/** Stable JSON stringify for cache keys — keys sorted for determinism. */
export function stableSerialize(value: unknown): string {
  if (value == null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableSerialize(obj[k])}`).join(",")}}`;
}

/**
 * Memoize prompt builders that return deterministic strings for the same inputs.
 * Used to avoid rebuilding large session instructions on every render/reconnect.
 */
export function getCachedPrompt(key: string, build: () => string): string {
  const cached = promptCache.get(key);
  if (cached) return cached;

  const built = build();
  if (promptCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = promptCache.keys().next().value;
    if (firstKey) promptCache.delete(firstKey);
  }
  promptCache.set(key, built);
  return built;
}

/** Test helper — clears the in-memory prompt cache. */
export function clearPromptCache(): void {
  promptCache.clear();
}
