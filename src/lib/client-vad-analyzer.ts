import {
  extractAudioFrameFeatures,
  type AudioFrameFeatures,
  type DynamicSilenceContext,
  resolveVadConfig,
  updateNoiseFloorRms,
  validateSpeechStart,
  type SpeechStartValidation,
  type VadConfig,
} from "./voice-activity-detection";

const SAMPLE_INTERVAL_MS = 40;
const MAX_FRAME_HISTORY = 48;

/**
 * Browser-side mic analyser that validates OpenAI server_vad events and tracks
 * utterance metrics for dynamic silence tuning.
 */
export class ClientVadAnalyzer {
  private readonly config: VadConfig;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private sampleTimer: number | null = null;
  private frequencyBuffer: Uint8Array<ArrayBuffer> | null = null;
  private timeDomainBuffer: Uint8Array<ArrayBuffer> | null = null;
  private recentFrames: AudioFrameFeatures[] = [];
  private noiseFloorRms = 0.01;
  private utteranceStartedAtMs: number | null = null;
  private midUtterancePauseCount = 0;
  private lastSpeechFrameAtMs: number | null = null;
  private lastUtteranceWasSubstantive = false;
  private candidateSpeaking = false;

  constructor(config: VadConfig = resolveVadConfig()) {
    this.config = config;
  }

  get isAttached(): boolean {
    return this.analyser !== null;
  }

  attach(stream: MediaStream): boolean {
    if (typeof window === "undefined") return false;
    const track = stream.getAudioTracks()[0];
    if (!track) return false;

    this.detach();

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2_048;
    analyser.smoothingTimeConstant = 0.55;

    const source = audioContext.createMediaStreamSource(new MediaStream([track]));
    source.connect(analyser);

    this.audioContext = audioContext;
    this.analyser = analyser;
    this.source = source;
    this.frequencyBuffer = new Uint8Array(analyser.frequencyBinCount);
    this.timeDomainBuffer = new Uint8Array(analyser.fftSize);
    this.recentFrames = [];
    this.startSampling();
    return true;
  }

  detach(): void {
    this.stopSampling();
    this.source?.disconnect();
    this.analyser?.disconnect();
    if (this.audioContext) {
      void this.audioContext.close().catch(() => undefined);
    }
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.frequencyBuffer = null;
    this.timeDomainBuffer = null;
    this.recentFrames = [];
    this.candidateSpeaking = false;
    this.utteranceStartedAtMs = null;
    this.midUtterancePauseCount = 0;
    this.lastSpeechFrameAtMs = null;
  }

  onCandidateSpeechStarted(): void {
    this.candidateSpeaking = true;
    this.utteranceStartedAtMs = Date.now();
    this.midUtterancePauseCount = 0;
    this.lastSpeechFrameAtMs = Date.now();
  }

  onCandidateSpeechStopped(): void {
    this.candidateSpeaking = false;
    this.utteranceStartedAtMs = null;
    this.lastSpeechFrameAtMs = null;
  }

  setLastUtteranceSubstantive(substantive: boolean): void {
    this.lastUtteranceWasSubstantive = substantive;
  }

  validateSpeechStart(): SpeechStartValidation {
    return validateSpeechStart(this.recentFrames, this.config, this.noiseFloorRms);
  }

  getDynamicSilenceContext(): DynamicSilenceContext {
    const utteranceDurationMs =
      this.utteranceStartedAtMs != null ? Date.now() - this.utteranceStartedAtMs : 0;
    return {
      utteranceDurationMs,
      midUtterancePauseCount: this.midUtterancePauseCount,
      lastUtteranceWasSubstantive: this.lastUtteranceWasSubstantive,
    };
  }

  private startSampling(): void {
    this.stopSampling();
    this.sampleTimer = window.setInterval(() => {
      this.sampleFrame();
    }, SAMPLE_INTERVAL_MS);
  }

  private stopSampling(): void {
    if (this.sampleTimer !== null) {
      window.clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }
  }

  private sampleFrame(): void {
    if (!this.analyser || !this.frequencyBuffer || !this.timeDomainBuffer || !this.audioContext) {
      return;
    }

    this.analyser.getByteFrequencyData(this.frequencyBuffer);
    this.analyser.getByteTimeDomainData(this.timeDomainBuffer);

    const frame = extractAudioFrameFeatures(
      this.frequencyBuffer,
      this.audioContext.sampleRate,
      Date.now(),
      this.timeDomainBuffer,
    );

    this.recentFrames.push(frame);
    if (this.recentFrames.length > MAX_FRAME_HISTORY) {
      this.recentFrames.shift();
    }

    const soundClass = frame.rms > this.noiseFloorRms * 1.35 ? "active" : "silent";
    if (soundClass === "silent" && !this.candidateSpeaking) {
      this.noiseFloorRms = updateNoiseFloorRms(this.noiseFloorRms, frame.rms);
    }

    if (this.candidateSpeaking) {
      const isSpeechLike =
        frame.rms >= this.config.speechMinRms * 0.75 &&
        frame.speechBandRatio >= this.config.speechMinBandRatio * 0.75;
      if (isSpeechLike) {
        this.lastSpeechFrameAtMs = frame.timestampMs;
      } else if (
        this.lastSpeechFrameAtMs != null &&
        frame.timestampMs - this.lastSpeechFrameAtMs >= 700 &&
        frame.timestampMs - this.lastSpeechFrameAtMs < 1_400
      ) {
        this.midUtterancePauseCount += 1;
        this.lastSpeechFrameAtMs = frame.timestampMs + 700;
      }
    }
  }
}
