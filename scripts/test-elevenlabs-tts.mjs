import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
const voiceId =
  process.env.ELEVENLABS_VOICE_ID_FEMALE?.trim() ||
  process.env.ELEVENLABS_VOICE_ID_MALE?.trim() ||
  "21m00Tcm4TlvDq8ikWAM";
const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_turbo_v2_5";

if (!apiKey) {
  console.error("ELEVENLABS_API_KEY is missing. Add it to .env or run:");
  console.error("  node --env-file=.env scripts/test-elevenlabs-tts.mjs");
  process.exitCode = 1;
} else {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: "Hello, this is a Uhired hybrid voice test using ElevenLabs.",
      model_id: modelId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 402) {
      console.error("ElevenLabs TTS blocked: free plan cannot use library voices via API.");
      console.error("Options:");
      console.error("  1) Upgrade ElevenLabs plan, or");
      console.error(
        "  2) Create a custom voice in ElevenLabs and set ELEVENLABS_VOICE_ID_MALE / ELEVENLABS_VOICE_ID_FEMALE in .env, or",
      );
      console.error("  3) Use OpenAI voice for now: VOICE_TTS_PROVIDER=openai");
    } else {
      console.error("ElevenLabs TTS failed:", response.status, errorText);
    }
    process.exitCode = 1;
  } else {
    const audio = await response.arrayBuffer();
    console.log(
      `ElevenLabs TTS OK: ${audio.byteLength} bytes, content-type=${response.headers.get("content-type")}`,
    );
  }
}
