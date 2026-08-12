import "server-only";
import { isEmailConfigured, sendPromoCodeEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { getEmailLinkBaseUrl } from "@/lib/public-app-url";
import { normalizeEmail } from "@/lib/parse-candidate-emails";

type PromoCodeEmailTarget = {
  code: string;
  durationMin: number;
  recipientEmail: string;
  companyName?: string | null;
};

export async function buildPromoPracticeUrl(
  request: Request,
  promoCode: string,
  durationMin: number,
  recipientEmail?: string | null,
  companyName?: string | null,
): Promise<string> {
  const base = getEmailLinkBaseUrl(request);
  const url = new URL("/practice", base);
  url.searchParams.set("promo", promoCode);
  url.searchParams.set("duration", String(durationMin));
  if (recipientEmail?.trim()) {
    url.searchParams.set("email", recipientEmail.trim().toLowerCase());
  }

  const trimmedCompany = companyName?.trim();
  if (trimmedCompany) {
    const company = await prisma.company.findUnique({
      where: { name: trimmedCompany },
      select: { domain: true },
    });
    if (company?.domain) {
      url.searchParams.set("domain", company.domain);
    }
  }

  return url.toString();
}

export async function sendPromoCodeNotificationEmail(
  request: Request,
  promo: PromoCodeEmailTarget,
): Promise<{ sent: boolean; error?: string }> {
  if (!isEmailConfigured()) {
    return { sent: false, error: "Email is not configured. Add SMTP or AWS SES settings." };
  }

  const to = normalizeEmail(promo.recipientEmail);
  if (!to) {
    return { sent: false, error: "Recipient email is required to send notification." };
  }

  try {
    const practiceUrl = await buildPromoPracticeUrl(
      request,
      promo.code,
      promo.durationMin,
      to,
      promo.companyName,
    );
    await sendPromoCodeEmail({
      to,
      promoCode: promo.code,
      durationMin: promo.durationMin,
      companyName: promo.companyName,
      practiceUrl,
    });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send promo code email.";
    return { sent: false, error: message };
  }
}
