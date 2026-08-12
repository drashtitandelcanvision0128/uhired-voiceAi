const durationOverride = Number(process.env.NEXT_PUBLIC_INTERVIEW_DURATION_SEC);

/** Default cap for voice interview timer (seconds). Session may use shorter `durationMin` from DB. */
export const DEFAULT_INTERVIEW_DURATION_SEC =
  Number.isFinite(durationOverride) && durationOverride > 0 ? durationOverride : 10 * 60;

export const REALTIME_MODEL = "gpt-realtime";
export const REALTIME_VOICE = "cedar";
