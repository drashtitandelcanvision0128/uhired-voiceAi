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

export async function dispatchAtsWebhook(input: {
  webhookUrl: string;
  secret?: string | null;
  payload: AtsWebhookPayload;
}) {
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
      console.warn(
        `[ats-webhook] ${input.webhookUrl} returned ${response.status}`,
      );
    }
  } catch (error) {
    console.error("[ats-webhook] dispatch failed:", error);
  } finally {
    clearTimeout(timeout);
  }
}
