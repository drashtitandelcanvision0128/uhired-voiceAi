"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ChevronDown,
  MessageSquare,
  Shield,
  ThumbsUp,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import {
  CUSTOM_FOCUS_AREA_TOPIC,
  getPracticePreviewContent,
  PRACTICE_FOCUS_AREAS,
  PRACTICE_PREVIEW_DURATION_MIN,
} from "@/lib/practice-focus-areas";
import { PracticeExperiencePreview } from "@/components/practice-experience-preview";
import { calculatePracticeTotalRupees } from "@/lib/practice-pricing-shared";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

export function PracticePageClient({ basePriceRupees }: { basePriceRupees: number }) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-background" />}>
      <PracticePageContent basePriceRupees={basePriceRupees} />
    </Suspense>
  );
}

function PracticePageContent({ basePriceRupees }: { basePriceRupees: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [selectedDomain, setSelectedDomain] = useState(PRACTICE_FOCUS_AREAS[0].domain);
  const [selectedTopic, setSelectedTopic] = useState(PRACTICE_FOCUS_AREAS[0].topic);
  const [selectedDuration, setSelectedDuration] = useState(10);
  const [customFocusArea, setCustomFocusArea] = useState("");
  const [prefillPromo, setPrefillPromo] = useState("");
  const [promoInviteActive, setPromoInviteActive] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [showFocusAreas, setShowFocusAreas] = useState(false);
  const bookingRef = useRef<HTMLElement | null>(null);
  const usingCustomFocusArea = customFocusArea.trim().length > 0;
  const effectiveDomain = usingCustomFocusArea ? customFocusArea.trim() : selectedDomain;
  const effectiveTopic = usingCustomFocusArea ? CUSTOM_FOCUS_AREA_TOPIC : selectedTopic;
  const previewContent = getPracticePreviewContent(
    usingCustomFocusArea ? "" : selectedDomain,
    usingCustomFocusArea ? customFocusArea : undefined,
  );

  const totalRupees = calculatePracticeTotalRupees(selectedDuration, basePriceRupees);
  const originalRupees = Math.round(totalRupees * 1.4);

  useEffect(() => {
    const domainParam = searchParams.get("domain")?.trim();
    const customParam = searchParams.get("custom")?.trim();
    const durationParam = Number(searchParams.get("duration"));
    const nameParam = searchParams.get("name")?.trim();
    const emailParam = searchParams.get("email")?.trim();
    const promoParam = searchParams.get("promo")?.trim();

    if (customParam) {
      setCustomFocusArea(customParam);
    } else if (domainParam) {
      const match = PRACTICE_FOCUS_AREAS.find((area) => area.domain === domainParam);
      if (match) {
        setSelectedDomain(match.domain);
        setSelectedTopic(match.topic);
      } else {
        setCustomFocusArea(domainParam);
      }
    }

    if (Number.isFinite(durationParam) && durationParam >= 10) {
      setSelectedDuration(durationParam);
    }
    if (nameParam) setCandidateName(nameParam);
    if (emailParam) setCandidateEmail(emailParam);
    if (promoParam) {
      setPrefillPromo(promoParam.toUpperCase());
      if (emailParam && Number.isFinite(durationParam) && durationParam >= 10) {
        setPromoInviteActive(true);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!promoInviteActive) return;
    bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [promoInviteActive]);

  async function startPracticeSession(payload: {
    candidateName: string;
    email: string;
    domain: string;
    topic: string;
    durationMin: number;
    promoCode?: string;
    paymentOrderId?: string;
    preview?: boolean;
  }) {
    const response = await fetch("/api/practice/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { sessionId?: string; error?: string };
    if (!response.ok || !data.sessionId) {
      throw new Error(data.error ?? "Unable to start interview.");
    }
    router.push(`/interview/${data.sessionId}`);
  }

  async function handleFreePreview() {
    setPreviewError("");
    setPreviewLoading(true);

    const resolvedName = candidateName.trim();
    const resolvedEmail = candidateEmail.trim().toLowerCase();

    try {
      if (!resolvedName || !resolvedEmail) {
        bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        throw new Error("Enter your name and email below to start the free preview.");
      }

      await startPracticeSession({
        candidateName: resolvedName,
        email: resolvedEmail,
        domain: effectiveDomain,
        topic: effectiveTopic,
        durationMin: PRACTICE_PREVIEW_DURATION_MIN,
        preview: true,
      });
    } catch (previewStartError) {
      setPreviewError(
        previewStartError instanceof Error
          ? previewStartError.message
          : "Unable to start free preview.",
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  async function ensureRazorpayScript() {
    if (typeof window !== "undefined" && window.Razorpay) return;
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
      );
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Unable to load Razorpay.")), {
          once: true,
        });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Unable to load Razorpay."));
      document.body.appendChild(script);
    });
  }

  async function handlePracticeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const payload = {
      candidateName: String(formData.get("candidateName") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      domain: String(formData.get("domain") ?? effectiveDomain),
      topic: String(formData.get("topic") ?? effectiveTopic),
      durationMin: Number(formData.get("durationMin") ?? selectedDuration),
      promoCode: String(formData.get("promoCode") ?? "").trim(),
    };

    try {
      if (!payload.candidateName || !payload.email) {
        throw new Error("Candidate name and email are required.");
      }

      if (payload.promoCode) {
        await startPracticeSession(payload);
        return;
      }

      const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!keyId) {
        throw new Error("Razorpay key is missing. Add NEXT_PUBLIC_RAZORPAY_KEY_ID.");
      }

      const orderRes = await fetch("/api/practice/payment/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: payload.candidateName,
          email: payload.email,
          domain: payload.domain,
          topic: payload.topic,
          durationMin: payload.durationMin,
        }),
      });
      const orderData = (await orderRes.json()) as {
        orderId?: string;
        amountPaise?: number;
        currency?: string;
        error?: string;
      };
      if (!orderRes.ok || !orderData.orderId || !orderData.amountPaise || !orderData.currency) {
        throw new Error(orderData.error ?? "Unable to initiate payment.");
      }

      await ensureRazorpayScript();
      await new Promise<void>((resolve, reject) => {
        const rz = new window.Razorpay({
          key: keyId,
          amount: orderData.amountPaise,
          currency: orderData.currency,
          name: "Uhired",
          description: `Practice Interview (${payload.durationMin} min)`,
          order_id: orderData.orderId,
          prefill: {
            name: payload.candidateName,
            email: payload.email,
          },
          theme: { color: "#0055D4" },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const verifyRes = await fetch("/api/practice/payment/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  orderId: response.razorpay_order_id,
                  paymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                }),
              });
              const verifyData = (await verifyRes.json()) as { ok?: boolean; error?: string };
              if (!verifyRes.ok || !verifyData.ok) {
                throw new Error(verifyData.error ?? "Payment verification failed.");
              }

              await startPracticeSession({
                ...payload,
                paymentOrderId: response.razorpay_order_id,
              });
              resolve();
            } catch (verifyError) {
              reject(
                verifyError instanceof Error
                  ? verifyError
                  : new Error("Unable to verify payment."),
              );
            }
          },
          modal: {
            ondismiss: () => reject(new Error("Payment cancelled.")),
          },
        });
        rz.open();
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to start interview.");
    } finally {
      setLoading(false);
    }
  }

  function scrollToBooking() {
    bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-blue-500/20">
      <SiteHeader />

      <main className="flex-1">
        <section className="pt-12 pb-8 md:pt-16 md:pb-10 bg-background">
          <div className="container max-w-7xl mx-auto px-4 md:px-8 text-center">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight mb-4">
              Preview the Experience
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              See how our AI-powered interview coach analyzes your performance in real-time
              with professional precision and institutional-grade feedback.
            </p>
          </div>
        </section>

        <section className="pb-12 md:pb-16 bg-background">
          <div className="container max-w-7xl mx-auto px-4 md:px-8">
            <PracticeExperiencePreview
              variant="practice-page"
              preview={previewContent}
              onTryFree={handleFreePreview}
              freeLoading={previewLoading}
              freeError={previewError}
            />

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start">
              <div className="space-y-6">
                <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-primary" />
                    </div>
                    <h2 className="text-lg font-bold text-foreground">Sample Question</h2>
                  </div>
                  <p className="text-primary text-sm md:text-base leading-relaxed font-medium">
                    {previewContent.sampleQuestion}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                      STAR Method Recommended
                    </span>
                    <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                      Behavioral
                    </span>
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ThumbsUp className="w-4 h-4 text-primary" />
                    </div>
                    <h2 className="text-lg font-bold text-foreground">Example Feedback</h2>
                  </div>

                  <div className="space-y-5">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <ThumbsUp className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground mb-1">Key Strength</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {previewContent.sampleFeedback}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground mb-1">Area for Growth</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Consider shortening your introduction and leading with the most
                          relevant outcome. The AI coach will help you refine pacing in
                          real time during your session.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setShowFocusAreas((open) => !open)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div>
                      <p className="text-sm font-bold text-foreground">Choose your focus area</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Currently: <span className="font-semibold text-primary">{effectiveDomain}</span>
                      </p>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-muted-foreground transition-transform ${
                        showFocusAreas ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {showFocusAreas ? (
                    <div className="mt-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {PRACTICE_FOCUS_AREAS.map(({ domain, topic }) => (
                          <button
                            type="button"
                            key={domain}
                            onClick={() => {
                              setSelectedDomain(domain);
                              setSelectedTopic(topic);
                              setCustomFocusArea("");
                            }}
                            className={`rounded-xl p-4 text-left border transition ${
                              !usingCustomFocusArea && selectedDomain === domain
                                ? "border-primary bg-primary/10"
                                : "border-border bg-muted/50 hover:border-primary/40"
                            }`}
                          >
                            <p className="text-sm font-bold text-foreground">{domain}</p>
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{topic}</p>
                          </button>
                        ))}
                      </div>
                      <input
                        value={customFocusArea}
                        onChange={(event) => setCustomFocusArea(event.target.value)}
                        placeholder="Or type a custom role (e.g. DevOps Engineer)"
                        className="w-full rounded-lg border border-border px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <aside ref={bookingRef} className="lg:sticky lg:top-24">
                {promoInviteActive && prefillPromo ? (
                  <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                    <p className="text-sm font-bold text-emerald-900">Free interview invite</p>
                    <p className="mt-1 text-sm text-emerald-800">
                      Promo code <span className="font-semibold">{prefillPromo}</span> is applied.
                      Enter your name below and click <span className="font-semibold">Start Interview</span>.
                    </p>
                  </div>
                ) : null}
                <form
                  id="practice-form"
                  onSubmit={handlePracticeSubmit}
                  className="bg-primary/5 rounded-2xl p-6 md:p-8 border border-primary/20"
                >
                  <h2 className="text-xl font-extrabold text-foreground mb-6">
                    Your Session Summary
                  </h2>

                  <dl className="space-y-0 mb-6">
                    {[
                      { label: "Interview Type", value: effectiveDomain },
                      { label: "Duration", value: `${selectedDuration} Minutes` },
                      { label: "Difficulty Level", value: "Senior Executive" },
                      { label: "AI Coach Intensity", value: "High (Stress Test)" },
                    ].map((row, index) => (
                      <div
                        key={row.label}
                        className={`flex justify-between items-center py-3 ${
                          index < 3 ? "border-b border-border" : ""
                        }`}
                      >
                        <dt className="text-sm text-muted-foreground">{row.label}</dt>
                        <dd className="text-sm font-bold text-foreground text-right max-w-[55%]">
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="space-y-3 mb-5">
                    <input
                      name="candidateName"
                      required
                      value={candidateName}
                      onChange={(event) => setCandidateName(event.target.value)}
                      placeholder="Your full name"
                      className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <input
                      name="email"
                      required
                      type="email"
                      value={candidateEmail}
                      onChange={(event) => setCandidateEmail(event.target.value)}
                      placeholder="Your email address"
                      className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <select
                      name="durationMin"
                      value={selectedDuration}
                      onChange={(event) => setSelectedDuration(Number(event.target.value))}
                      className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value={10}>10 Minutes</option>
                      <option value={15}>15 Minutes</option>
                      <option value={30}>30 Minutes</option>
                      <option value={45}>45 Minutes</option>
                      <option value={60}>60 Minutes</option>
                      <option value={90}>90 Minutes</option>
                      <option value={120}>120 Minutes</option>
                    </select>
                  </div>

                  <input type="hidden" name="domain" value={effectiveDomain} />
                  <input type="hidden" name="topic" value={effectiveTopic} />

                  <div className="bg-card rounded-xl p-5 mb-5">
                    {!prefillPromo ? (
                      <>
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-lg text-muted-foreground line-through">
                            ₹{originalRupees}
                          </span>
                          <span className="text-3xl font-extrabold text-primary">
                            ₹{totalRupees}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-emerald-600 mb-4">
                          LIMITED TIME: 40% OFF FIRST SESSION
                        </p>
                      </>
                    ) : (
                      <p className="mb-4 text-sm font-semibold text-emerald-700">
                        Payment skipped — your promo code covers this session.
                      </p>
                    )}

                    <input
                      name="promoCode"
                      value={prefillPromo}
                      onChange={(event) => setPrefillPromo(event.target.value.toUpperCase())}
                      placeholder="Promo code (optional)"
                      className="w-full rounded-lg border border-border px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 uppercase mb-4"
                    />

                    {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
                    >
                      {loading
                        ? "Starting interview..."
                        : prefillPromo
                          ? "Start Interview"
                          : "Confirm & Book Now"}
                    </button>
                  </div>

                  <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Shield className="w-3.5 h-3.5" />
                    Secure Payment &amp; 100% Privacy Guaranteed
                  </p>
                </form>
              </aside>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20 bg-foreground mx-4 md:mx-8 mb-8 rounded-2xl">
          <div className="container max-w-3xl mx-auto px-4 md:px-8 text-center">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-3">
              Ready for the full session?
            </h2>
            <p className="text-sm md:text-base text-white/70 mb-8 leading-relaxed">
              Get personalized, data-driven coaching that adapts to your responses and
              helps you master every interview scenario.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                type="button"
                onClick={scrollToBooking}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-primary/90 w-full sm:w-auto"
              >
                Start Full Practice
              </button>
              <Link
                href="/#features"
                className="inline-flex items-center justify-center rounded-lg border border-white/30 bg-transparent px-8 py-3.5 text-sm font-semibold text-white no-underline transition hover:bg-card/10 w-full sm:w-auto"
              >
                Browse Case Studies
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
