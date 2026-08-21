import { createHmac } from "crypto";

export type AtsWebhookPayload = {
  event: "interview.completed";
  sessionId: string;
  companyId: string | null;
  candidateName: string | null;
  candidateEmail: string | null;
  requirementId: string | null;
  positionTitle: string | null;
  status: string;
  overallScore: number | null;
  completedAt: string;
};

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function postOnce(input: {
  webhookUrl: string;
  secret?: string | null;
  payload: AtsWebhookPayload;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  const body = JSON.stringify(input.payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Uhired-ATS-Webhook/1.0",
  };

  if (input.secret?.trim()) {
    const signature = createHmac("sha256", input.secret.trim())
      .update(body)
      .digest("hex");
    headers["X-Uhired-Signature"] = `sha256=${signature}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(input.webhookUrl, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    }
    return { ok: true, status: response.status };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "ATS webhook dispatch failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Dispatch ATS webhook with bounded retries (network / 5xx friendly).
 */
export async function dispatchAtsWebhook(input: {
  webhookUrl: string;
  secret?: string | null;
  payload: AtsWebhookPayload;
  maxAttempts?: number;
}) {
  const maxAttempts = Math.min(Math.max(input.maxAttempts ?? 3, 1), 5);
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await postOnce(input);
    if (result.ok) return { ok: true as const, attempts: attempt };
    lastError = result.error ?? "unknown";
    console.warn(
      `[ats-webhook] attempt ${attempt}/${maxAttempts} failed for ${input.webhookUrl}: ${lastError}`,
    );
    if (attempt < maxAttempts) {
      await sleep(500 * attempt * attempt);
    }
  }

  console.error(`[ats-webhook] gave up after ${maxAttempts} attempts: ${lastError}`);
  return { ok: false as const, attempts: maxAttempts, error: lastError };
}
