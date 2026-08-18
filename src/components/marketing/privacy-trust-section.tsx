import Link from "next/link";
import { Camera, Lock, Mic, ShieldCheck, Trash2 } from "lucide-react";
import { FadeInLeft } from "@/components/marketing/animations";

const trustPoints = [
  {
    icon: Camera,
    title: "Camera & microphone",
    description:
      "Sessions use your camera and mic so the AI interviewer can see and hear you in real time. Your browser asks for permission first — you stay in control.",
    bgLight: "bg-primary/10",
  },
  {
    icon: Mic,
    title: "What we store from practice",
    description:
      "Practice sessions save transcripts and feedback scores so you can improve. We do not record or store practice session video.",
    bgLight: "bg-primary/10",
  },
  {
    icon: Lock,
    title: "Company hiring interviews",
    description:
      "When you interview through an employer on Uhired, session video may be recorded and shared only with that hiring team.",
    bgLight: "bg-accent/10",
  },
  {
    icon: Trash2,
    title: "Your data, your rights",
    description:
      "We never sell your personal information. Request access, correction, or deletion anytime — see our Privacy Policy for details.",
    bgLight: "bg-emerald-500/10",
  },
] as const;

export function PrivacyTrustSection() {
  return (
    <section
      id="privacy"
      className="py-16 md:py-24 bg-muted/30 border-y border-border scroll-mt-24"
    >
      <div className="container max-w-7xl mx-auto px-4 md:px-8">
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-emerald-500/20 rounded-full mb-6 shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
              Privacy & trust
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-3 tracking-tight">
            Built for interviews — with your privacy in mind
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            Uhired uses camera and microphone during live interviews. Here is how
            your data is handled, stored, and protected.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {trustPoints.map((point, index) => {
            const Icon = point.icon;
            return (
              <FadeInLeft key={point.title} delay={index * 0.1}>
                <div className="glass h-full rounded-[2rem] p-8 transition-all duration-500 hover:border-primary/30">
                  <div
                    className={`w-14 h-14 ${point.bgLight} dark:bg-primary/10 rounded-2xl flex items-center justify-center mb-6`}
                  >
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">
                    {point.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">{point.description}</p>
                </div>
              </FadeInLeft>
            );
          })}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">
          Interview content may be processed by AI providers to deliver coaching
          and evaluations.{" "}
          <Link href="/privacy" className="font-semibold text-primary hover:underline">
            Read our full Privacy Policy
          </Link>
        </p>
      </div>
    </section>
  );
}

export function CameraMicTrustNotice({ className = "" }: { className?: string }) {
  return (
    <div
      className={`glass-light rounded-2xl border border-primary/20 p-4 ${className}`}
      role="note"
      aria-label="Camera and microphone privacy notice"
    >
      <div className="flex gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">
            Camera &amp; mic are used during your session
          </p>
          <p>
            Practice saves transcripts and feedback only — not video.{" "}
            <Link href="/privacy" className="font-semibold text-primary hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
