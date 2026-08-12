import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Globe,
  Heart,
  Lightbulb,
  Route,
  Shield,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { MarketingBackground } from "@/components/marketing/site/marketing-page-shell";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about Uhired — AI-powered interview coaching for professionals and hiring teams.",
};

const coreValues = [
  {
    icon: Shield,
    title: "Excellence",
    description:
      "We're committed to delivering the highest quality AI coaching and insights.",
  },
  {
    icon: Heart,
    title: "Accessibility",
    description:
      "Career development should be available to everyone, regardless of background.",
  },
  {
    icon: Sparkles,
    title: "Innovation",
    description:
      "We continuously push the boundaries of what AI can achieve in coaching.",
  },
  {
    icon: ShieldCheck,
    title: "Transparency",
    description:
      "We're honest about our capabilities and committed to user privacy.",
  },
];

const differentiators = [
  {
    icon: Waves,
    title: "Real-time Behavioral Analysis",
    description:
      "Our AI analyzes your tone, pace, and content in real-time to provide actionable feedback.",
  },
  {
    icon: Route,
    title: "Adaptive Learning Paths",
    description:
      "Every session adapts to your skill level and targets your specific improvement areas.",
  },
  {
    icon: BarChart3,
    title: "Industry-Specific Benchmarking",
    description:
      "Compare your performance against industry standards for your target role and company.",
  },
];

const impactStats = [
  { number: "50k+", label: "Interviews Mastered" },
  { number: "85%", label: "Offer Success Rate" },
  { number: "120+", label: "Countries Reached" },
  { number: "4.9/5", label: "User Satisfaction" },
];

export default function AboutPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20">
      <MarketingBackground />
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden pt-16 pb-20 md:pt-20 md:pb-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,210,255,0.08)_0%,_transparent_70%)]" />

          <div className="container relative z-10 mx-auto max-w-4xl px-4 text-center md:px-8">
            <div className="glass-light mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 px-4 py-1.5">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Our Story
              </span>
            </div>

            <h1 className="mb-6 text-4xl font-extrabold leading-[1.15] tracking-tight text-foreground md:text-5xl">
              Empowering Professionals to{" "}
              <span className="text-primary">Master Interviews</span>
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Uhired was founded on a simple belief: everyone deserves access to
              world-class interview coaching. We&apos;re building the future of
              career development through AI-powered intelligence.
            </p>

            <Link
              href="/practice"
              className="btn-glow inline-flex items-center justify-center rounded-full px-8 py-3.5 text-base font-semibold text-white no-underline"
            >
              Join Our Journey
            </Link>
          </div>
        </section>

        {/* Mission & Vision */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto max-w-6xl px-4 md:px-8">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
              <div className="glass rounded-2xl p-8 md:p-10">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <h2 className="mb-4 text-xl font-bold text-foreground md:text-2xl">
                  Our Mission
                </h2>
                <p className="text-base leading-relaxed text-muted-foreground">
                  To democratize access to elite-level interview coaching by
                  leveraging cutting-edge AI technology. We believe that
                  interview success shouldn&apos;t be limited to those who can
                  afford expensive coaches—everyone deserves the tools to
                  excel.
                </p>
              </div>

              <div className="glass rounded-2xl p-8 md:p-10">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Lightbulb className="h-6 w-6 text-primary" />
                </div>
                <h2 className="mb-4 text-xl font-bold text-foreground md:text-2xl">
                  Our Vision
                </h2>
                <p className="text-base leading-relaxed text-muted-foreground">
                  A world where professionals confidently step into interviews,
                  armed with personalized insights and proven strategies. We
                  envision a future where career advancement is determined by
                  merit and preparation, not luck or connections.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Core Values */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto max-w-6xl px-4 md:px-8">
            <div className="mb-12 text-center md:mb-14">
              <h2 className="mb-3 text-3xl font-extrabold md:text-4xl">
                Our Core Values
              </h2>
              <p className="text-base text-muted-foreground md:text-lg">
                These principles guide everything we do at Uhired
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {coreValues.map((value) => {
                const Icon = value.icon;
                return (
                  <div
                    key={value.title}
                    className="glass rounded-2xl p-6"
                  >
                    <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/20">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="mb-3 text-lg font-bold">
                      {value.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {value.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Why Uhired is Different */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto max-w-6xl px-4 md:px-8">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div>
                <h2 className="mb-10 text-3xl font-extrabold text-foreground md:text-4xl">
                  Why Uhired is{" "}
                  <span className="text-primary">Different</span>
                </h2>

                <div className="space-y-8">
                  {differentiators.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.title} className="flex gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="mb-2 text-base font-bold text-primary md:text-lg">
                            {item.title}
                          </h3>
                          <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                <Image
                  src="/marketing/about-office.png"
                  alt="Professional working at a modern office desk with multiple monitors displaying Uhired"
                  width={640}
                  height={480}
                  className="h-auto w-full object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        {/* Our Impact */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto max-w-6xl px-4 md:px-8">
            <h2 className="mb-12 text-center text-3xl font-extrabold md:mb-14 md:text-4xl">
              Our Impact
            </h2>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
              {impactStats.map((stat) => (
                <div
                  key={stat.label}
                  className="glass rounded-2xl p-6 text-center md:p-8"
                >
                  <p className="mb-2 text-3xl font-extrabold text-primary md:text-4xl">
                    {stat.number}
                  </p>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground md:text-sm">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 pb-16 md:px-8 md:pb-20">
          <div className="container relative mx-auto max-w-6xl overflow-hidden rounded-3xl glass px-6 py-14 text-center md:px-12 md:py-16">
            <div
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='20' viewBox='0 0 100 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M21.184 20c.357-.13.72-.264 1.088-.402l1.768-.661C33.64 15.347 39.647 14 50 14c10.271 0 15.362 1.222 24.629 4.928.955.383 1.869.74 2.75 1.07.881.331 1.725.63 2.54.895.815.265 1.6.496 2.36.693.76.197 1.49.36 2.19.49.7.13 1.37.227 2.01.29.64.063 1.25.093 1.83.093.58 0 1.13-.03 1.65-.09.52-.06 1.01-.15 1.47-.27.46-.12.89-.27 1.29-.45.4-.18.77-.39 1.11-.63.34-.24.65-.51.93-.81.28-.3.53-.63.75-.99.22-.36.41-.75.57-1.17.16-.42.29-.87.39-1.35.1-.48.17-.99.21-1.53.04-.54.06-1.11.06-1.71 0-.6-.02-1.17-.06-1.71-.04-.54-.11-1.05-.21-1.53-.1-.48-.23-.93-.39-1.35-.16-.42-.35-.81-.57-1.17-.22-.36-.47-.69-.75-.99-.28-.3-.59-.57-.93-.81-.34-.24-.71-.45-1.11-.63-.4-.18-.83-.33-1.29-.45-.46-.12-.95-.21-1.47-.27-.52-.06-1.07-.09-1.65-.09-.58 0-1.19.03-1.83.093-.64.06-1.31.16-2.01.29-.7.13-1.43.293-2.19.49-.76.197-1.545.428-2.36.693-.815.265-1.659.564-2.54.895-.881.331-1.795.687-2.75 1.07C65.362 15.222 60.271 14 50 14c-10.353 0-16.36 1.347-26.128 5.338l-1.768.661C21.72 19.736 21.357 19.87 21.184 20z' fill='%233b82f6' fill-opacity='0.15' fill-rule='evenodd'/%3E%3C/svg%3E")`,
                backgroundRepeat: "repeat",
              }}
            />

            <div className="relative z-10">
              <h2 className="mb-4 text-3xl font-extrabold md:text-4xl">
                Join the{" "}
                <span className="text-gradient">Uhired Community</span>
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-base text-muted-foreground md:text-lg">
                Start your journey to interview mastery today and unlock your
                full potential with the power of AI.
              </p>
              <Link
                href="/practice"
                className="btn-glow inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold text-white no-underline"
              >
                Get Started Now
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
