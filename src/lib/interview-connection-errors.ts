/** User-facing messages for live interview connection / device failures. */

export function formatMediaPermissionError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  const message = error instanceof Error ? error.message : "";

  if (name === "NotAllowedError" || /permission|denied|notallowed/i.test(message)) {
    return "Camera or microphone permission was denied. Allow access in your browser settings, then run the device check again.";
  }
  if (name === "NotFoundError" || /not found|no device/i.test(message)) {
    return "No camera or microphone was found. Plug in a device and try the device check again.";
  }
  if (name === "NotReadableError" || /in use|busy|trackstart/i.test(message)) {
    return "Camera or microphone is already in use by another app. Close that app and try again.";
  }
  if (/secure|https|getusermedia/i.test(message)) {
    return "Camera/microphone need a secure (HTTPS) page. Open the interview link from your invite email.";
  }
  return message.trim() || "Camera or microphone access failed. Check permissions and try again.";
}

export function formatRealtimeConnectionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/openai|realtime|api key|not configured/i.test(message)) {
    return "AI voice service is temporarily unavailable. Wait a moment, then click Start voice interview to reconnect.";
  }
  if (/timeout|network|failed to fetch|offline|disconnect/i.test(message)) {
    return "Network connection dropped. Check your internet, then reconnect to continue the interview.";
  }
  if (/429|rate.?limit|quota/i.test(message)) {
    return "AI voice is busy right now. Wait ~30 seconds and reconnect.";
  }
  return message.trim() || "Voice connection failed. Click Start voice interview to reconnect.";
}
