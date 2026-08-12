import type { Metadata } from "next";
import Link from "next/link";
import {
  User,
  Mail,
  Briefcase,
  ArrowRight,
  Pencil,
  Star,
  History,
} from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { MarketingBackground } from "@/components/marketing/site/marketing-page-shell";

export const metadata: Metadata = {
  title: "Profile",
  description: "Manage your Uhired candidate profile and interview preferences.",
};

const profileFields = [
  {
    icon: User,
    label: "Full Name",
    value: "Your Name",
    hint: "Enter your name when configuring a session on the home page.",
  },
  {
    icon: Mail,
    label: "Email",
    value: "your@email.com",
    hint: "Used for session receipts and practice history.",
  },
  {
    icon: Briefcase,
    label: "Target Role",
    value: "Senior Product Designer",
    hint: "Select your focus area when booking a session.",
  },
];

export default function ProfilePage() {
  return (
    <div className="relative min-h-screen flex flex-col bg-background text-foreground selection:bg-blue-500/20">
      <MarketingBackground />
      <SiteHeader />

      <main className="flex-1">
        <section className="pt-12 pb-16 md:pt-16 md:pb-20">
          <div className="container max-w-4xl mx-auto px-4 md:px-8">
            <div className="mb-10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-3">
                Profile
              </p>
              <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mb-3">
                Your candidate profile
              </h1>
              <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
                This information helps our AI tailor your mock interview
                questions and provide role-specific feedback.
              </p>
            </div>

            <div className="bg-card rounded-2xl border border-border shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
              {profileFields.map((field, index) => {
                const Icon = field.icon;
                return (
                  <div
                    key={field.label}
                    className={`flex items-center gap-4 px-6 py-5 md:px-8 md:py-6 ${
                      index < profileFields.length - 1
                        ? "border-b border-border"
                        : ""
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9ca3af] mb-1">
                        {field.label}
                      </p>
                      <p className="text-lg font-bold text-foreground">
                        {field.value}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">{field.hint}</p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[#9ca3af] hover:text-primary hover:bg-muted/50 transition-colors"
                      aria-label={`Edit ${field.label}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

              <div className="px-6 py-5 md:px-8 md:py-6 bg-muted/50 border-t border-border">
                <Link
                  href="/#booking-section"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-primary/90"
                >
                  Configure Your Session
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-5 h-5 text-primary" />
                  <h2 className="text-base font-bold text-foreground">
                    Interview Readiness
                  </h2>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: "75%" }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  You&apos;re 75% ready for your next session. Complete your
                  profile for 100%.
                </p>
              </div>

              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <History className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground mb-1">
                      Recent Practice
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Last session: 2 days ago (Behavioral)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
