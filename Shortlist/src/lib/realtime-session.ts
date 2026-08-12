import { REALTIME_MODEL, REALTIME_VOICE } from "@/lib/constants";
import { REALTIME_TURN_DETECTION } from "@/lib/interview-prompt";
import type { RealtimeBuiltinVoice } from "@/lib/interviewer-profile";
import {
  buildTranscriptionPrompt,
  REALTIME_TRANSCRIPTION_MODEL,
  type TranscriptionContext,
} from "@/lib/speech-transcription";

export const REALTIME_AUDIO_RESPONSE = {
  output_modalities: ["audio"] as const,
};

export const REALTIME_TEXT_RESPONSE = {
  output_modalities: ["text"] as const,
};

export type RealtimeSessionOptions = {
  interruptResponse?: boolean;
  voice?: RealtimeBuiltinVoice;
  transcription?: TranscriptionContext;
  useElevenLabsTts?: boolean;
};

export function resolveRealtimeResponseMode(useElevenLabsTts?: boolean) {
  return useElevenLabsTts ? REALTIME_TEXT_RESPONSE : REALTIME_AUDIO_RESPONSE;
}

export function buildRealtimeSessionConfig(
  instructions: string,
  options?: RealtimeSessionOptions,
) {
  const voice = options?.voice ?? REALTIME_VOICE;
  const transcriptionPrompt = buildTranscriptionPrompt(options?.transcription ?? {});
  const useElevenLabsTts = options?.useElevenLabsTts ?? false;
  const outputModalities = useElevenLabsTts ? (["text"] as const) : (["audio"] as const);

  return {
    type: "realtime" as const,
    model: REALTIME_MODEL,
    instructions,
    output_modalities: outputModalities,
    include: ["item.input_audio_transcription.logprobs"] as const,
    audio: {
      input: {
        noise_reduction: { type: "near_field" as const },
        transcription: {
          model: REALTIME_TRANSCRIPTION_MODEL,
          language: "en",
          prompt: transcriptionPrompt,
        },
        turn_detection: {
          ...REALTIME_TURN_DETECTION,
          // Client triggers response.create after a short post-speech delay for reliable turn-taking.
          create_response: false,
          interrupt_response: options?.interruptResponse ?? true,
        },
      },
      ...(useElevenLabsTts ? {} : { output: { voice } }),
    },
  };
}
