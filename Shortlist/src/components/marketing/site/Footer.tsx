import Link from "next/link";
import { Globe, Share2, Users } from "lucide-react";
import { Logo } from "./Navbar";

const columns = [
  {
    title: "Platform",
    items: [
      { label: "Platform Overview", href: "/platform" },
      { label: "AI Interviews", href: "/ai-interviews" },
      { label: "Candidate Screening", href: "/candidate-screening" },
      { label: "AI Evaluation", href: "/ai-evaluation" },
      { label: "Interview Analytics", href: "/interview-analytics" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Careers", href: "/careers" },
    ],
  },
  {
    title: "Resources",
    items: [
      { label: "Practice", href: "/practice" },
      { label: "Blog", href: "/blog" },
      { label: "Help Center", href: "/help" },
    ],
  },
  {
    title: "Legal",
    items: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-border bg-surface/40">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              AI-powered hiring, built for the future.
            </p>
            <div className="mt-6 flex gap-3">
              {[
                { Icon: Users, label: "LinkedIn" },
                { Icon: Share2, label: "X" },
                { Icon: Globe, label: "GitHub" },
              ].map(({ Icon, label }) => (
                <a
                  key={label}
                  href="/"
                  aria-label={label}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface/60 text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((col) => (
              <div key={col.title}>
                <h3 className="font-display text-sm font-semibold text-foreground">{col.title}</h3>
                <ul className="mt-4 space-y-3">
                  {col.items.map((item) => (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground no-underline"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 border-t border-border pt-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Uhired AI. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
