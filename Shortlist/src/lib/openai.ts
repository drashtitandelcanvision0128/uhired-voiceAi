import type { RealtimeBuiltinVoice } from "@/lib/interviewer-profile";
import { env } from "@/lib/env";
import { buildRealtimeSessionConfig } from "@/lib/realtime-session";
import type { TranscriptionContext } from "@/lib/speech-transcription";

export async function createRealtimeClientSecret(
  instructions: string,
  options?: {
    voice?: RealtimeBuiltinVoice;
    transcription?: TranscriptionContext;
    useElevenLabsTts?: boolean;
  },
) {
  if (!env.openAiApiKey) {
    return {
      realtimeToken: "",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
  }

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: buildRealtimeSessionConfig(instructions, {
        interruptResponse: false,
        voice: options?.voice,
        transcription: options?.transcription,
        useElevenLabsTts: options?.useElevenLabsTts,
      }),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create realtime client secret: ${errorText}`);
  }

  const payload = (await response.json()) as {
    value?: string;
    expires_at?: number;
  };

  return {
    realtimeToken: payload.value ?? "",
    expiresAt: payload.expires_at
      ? new Date(payload.expires_at * 1000).toISOString()
      : new Date(Date.now() + 60_000).toISOString(),
  };
}
