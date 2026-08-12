"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Code2,
  BarChart3,
  Globe,
  Check,
  ArrowRight,
  User,
  Clock,
  Lock,
} from "lucide-react";
import {
  getPracticePreviewContent,
  PRACTICE_FOCUS_AREAS,
  PRACTICE_PREVIEW_DURATION_MIN,
} from "@/lib/practice-focus-areas";
import { PracticeExperiencePreview } from "@/components/practice-experience-preview";
import {
  calculatePracticeTotalRupees,
  formatPracticeRupees,
} from "@/lib/practice-pricing-shared";

const FEATURED_AREAS = [
  {
    domain: "Software Engineering",
    label: "Software Engineering",
    icon: Code2,
    description:
      "Master algorithms, system design, and technical problem-solving with AI-driven mock interviews.",
  },
  {
    domain: "Data Science & Analytics",
    label: "Data Science",
    icon: BarChart3,
    description:
      "Practice statistics, ML fundamentals, and data interpretation with personalized feedback.",
  },
  {
    domain: "UI/UX & Design",
    label: "UI/UX Design",
    icon: Globe,
    description:
      "Sharpen your design thinking, user research, and prototyping skills in realistic scenarios.",
  },
];

type InteractiveBookingProps = {
  basePriceRupees?: number;
};

export function InteractiveBooking({ basePriceRupees }: InteractiveBookingProps = {}) {
  const router = useRouter();
  const [selectedFocusArea, setSelectedFocusArea] = useState<string>("UI/UX & Design");
  const [candidateName, setCandidateName] = useState("Senior Product Designer");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [sessionLength, setSessionLength] = useState("45");
  const [aiCoachVideo, setAiCoachVideo] = useState(false);
  const [resumeAnalysis, setResumeAnalysis] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [error, setError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingDuration, setEditingDuration] = useState(false);

  const selectedArea = PRACTICE_FOCUS_AREAS.find((area) => area.domain === selectedFocusArea);
  const effectiveTopic = selectedArea?.topic ?? "";
  const previewContent = getPracticePreviewContent(selectedFocusArea);
  const durationMin = Number(sessionLength) || 45;
  const totalRupees = calculatePracticeTotalRupees(durationMin, basePriceRupees);
  const totalDisplay = formatPracticeRupees(totalRupees);

  function handleContinue() {
    setError("");
    const name = candidateName.trim();
    const email = candidateEmail.trim().toLowerCase();

    if (!name) {
      setError("Please enter your name to continue.");
      return;
    }

    const params = new URLSearchParams({
      name,
      email: email || "candidate@example.com",
      duration: sessionLength || "45",
      domain: selectedFocusArea,
    });

    if (promoCode.trim()) {
      params.set("promo", promoCode.trim());
    }

    router.push(`/practice?${params.toString()}#practice-form`);
  }

  async function handleFreePreview() {
    setPreviewError("");
    const name = candidateName.trim();
    const email = candidateEmail.trim().toLowerCase();

    if (!name) {
      setPreviewError("Enter your name to start the free preview.");
      return;
    }

    setPreviewLoading(true);
    try {
      const response = await fetch("/api/practice/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: name,
          email: email || "preview@uhired.in",
          domain: selectedFocusArea,
          topic: effectiveTopic,
          durationMin: PRACTICE_PREVIEW_DURATION_MIN,
          preview: true,
        }),
      });
      const data = (await response.json()) as { sessionId?: string; error?: string };
      if (!response.ok || !data.sessionId) {
        throw new Error(data.error ?? "Unable to start free preview.");
      }
      router.push(`/interview/${data.sessionId}`);
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

  return (
    <>
      {/* Specializations Section */}
      <section id="features" className="py-16 md:py-20 bg-background scroll-mt-20">
        <div className="container max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3">
              Specializations
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
              Choose your focus area
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {FEATURED_AREAS.map((area) => {
              const Icon = area.icon;
              const isSelected = selectedFocusArea === area.domain;
              return (
                <div
                  key={area.domain}
                  onClick={() => setSelectedFocusArea(area.domain)}
                  className={`cursor-pointer rounded-2xl border-2 p-6 transition-all duration-300 ${
                    isSelected
                      ? "glass border-primary shadow-[0_0_30px_rgba(0,210,255,0.15)]"
                      : "glass-light border-white/10 hover:border-primary/40"
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">{area.label}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {area.description}
                  </p>
                  {isSelected ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      <Check className="w-4 h-4" />
                      Selected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                      Select Path
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Session Configuration Section */}
      <section id="booking-section" className="py-16 md:py-20 bg-muted/40 scroll-mt-20">
        <div className="container max-w-7xl mx-auto px-4 md:px-8">
          <div className="mb-10">
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
              Your Session
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              Configure your interview experience for maximum impact.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Left: Settings */}
            <div className="flex-1 w-full space-y-4">
              <div className="glass overflow-hidden rounded-2xl">
                {/* Candidate Profile Row */}
                <div className="p-6 border-b border-border">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Candidate Profile
                        </p>
                        {editingProfile ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={candidateName}
                              onChange={(e) => setCandidateName(e.target.value)}
                              className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                              placeholder="Your name or role"
                            />
                            <input
                              type="email"
                              value={candidateEmail}
                              onChange={(e) => setCandidateEmail(e.target.value)}
                              className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                              placeholder="Email address"
                            />
                          </div>
                        ) : (
                          <p className="text-lg font-bold text-foreground">{candidateName}</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingProfile(!editingProfile)}
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      {editingProfile ? "Save" : "Edit"}
                    </button>
                  </div>
                </div>

                {/* Session Duration Row */}
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                          Session Duration
                        </p>
                        {editingDuration ? (
                          <select
                            value={sessionLength}
                            onChange={(e) => setSessionLength(e.target.value)}
                            className="border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                          >
                            <option value="15">15 Minutes</option>
                            <option value="30">30 Minutes</option>
                            <option value="45">45 Minutes</option>
                            <option value="60">60 Minutes</option>
                          </select>
                        ) : (
                          <p className="text-lg font-bold text-foreground">
                            {sessionLength} Minutes Mock Session
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingDuration(!editingDuration)}
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      {editingDuration ? "Save" : "Change"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Toggle Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="glass-light flex items-center justify-between rounded-2xl p-5">
                  <span className="text-sm font-semibold text-foreground">AI Coach Video</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={aiCoachVideo}
                    onClick={() => setAiCoachVideo(!aiCoachVideo)}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      aiCoachVideo ? "bg-primary" : "bg-muted-foreground/40"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-6 h-6 bg-background rounded-full shadow transition-transform ${
                        aiCoachVideo ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                <div className="glass-light flex items-center justify-between rounded-2xl p-5">
                  <span className="text-sm font-semibold text-foreground">Resume Analysis</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={resumeAnalysis}
                    onClick={() => setResumeAnalysis(!resumeAnalysis)}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      resumeAnalysis ? "bg-primary" : "bg-muted-foreground/40"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-6 h-6 bg-background rounded-full shadow transition-transform ${
                        resumeAnalysis ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Summary Card */}
            <div className="w-full shrink-0 lg:w-[380px]">
              <div className="glass rounded-2xl p-8">
                <h3 className="text-xl font-extrabold text-foreground mb-6">Summary</h3>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Standard Session</span>
                    <span className="font-semibold text-foreground">{totalDisplay}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Resume Deep-Dive</span>
                    <span className="font-semibold text-emerald-600">Free</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Tax</span>
                    <span className="font-semibold text-foreground">₹0</span>
                  </div>
                  <div className="border-t border-border pt-4 flex justify-between items-center">
                    <span className="text-base font-bold text-foreground">Total</span>
                    <span className="text-3xl font-extrabold text-primary">
                      {totalDisplay}
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Promo code"
                    className="w-full border border-border rounded-lg px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 uppercase"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                  />
                </div>

                {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

                <button
                  type="button"
                  onClick={handleContinue}
                  className="btn-glow mb-4 w-full rounded-xl py-4 text-base font-semibold text-white transition-colors"
                >
                  Continue to Checkout
                </button>

                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="w-3.5 h-3.5" />
                  Secure payment via Razorpay
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Preview Section */}
      <PracticeExperiencePreview
        preview={previewContent}
        onTryFree={handleFreePreview}
        freeLoading={previewLoading}
        freeError={previewError}
      />
    </>
  );
}
