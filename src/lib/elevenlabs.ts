import "server-only";

import type { InterviewerVoiceGender } from "@prisma/client";
import { env } from "@/lib/env";

export const DEFAULT_ELEVENLABS_VOICE_BY_GENDER = {
  MALE: "pNInz6obpgDQGcFmaJgB",
  FEMALE: "21m00Tcm4TlvDq8ikWAM",
} as const;

export function resolveElevenLabsVoiceId(
  gender: InterviewerVoiceGender | null | undefined,
): string {
  if (gender === "FEMALE") {
    return env.elevenlabsVoiceIdFemale || DEFAULT_ELEVENLABS_VOICE_BY_GENDER.FEMALE;
  }
  return env.elevenlabsVoiceIdMale || DEFAULT_ELEVENLABS_VOICE_BY_GENDER.MALE;
}

export async function synthesizeElevenLabsSpeech(
  text: string,
  voiceId: string,
): Promise<{ audio: ArrayBuffer; contentType: string }> {
  if (!env.elevenlabsApiKey) {
    throw new Error("ElevenLabs is not configured. Set ELEVENLABS_API_KEY.");
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("TTS text is empty.");
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": env.elevenlabsApiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: trimmed,
      model_id: env.elevenlabsModelId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs TTS failed (${response.status}): ${errorText.slice(0, 240)}`);
  }

  const contentType = response.headers.get("content-type") || "audio/mpeg";
  const audio = await response.arrayBuffer();
  return { audio, contentType };
}
