export type VoiceTtsProvider = "openai" | "elevenlabs";

export function resolveVoiceTtsProvider(raw: string | undefined): VoiceTtsProvider {
  const value = raw?.trim().toLowerCase();
  return value === "elevenlabs" ? "elevenlabs" : "openai";
}

export function isElevenLabsTtsEnabled(provider: VoiceTtsProvider, apiKey: string): boolean {
  return provider === "elevenlabs" && Boolean(apiKey.trim());
}
