"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Building2,
  CreditCard,
  FileBarChart,
  LifeBuoy,
  Mail,
  ScrollText,
  Search,
  Settings,
  Shield,
  TicketPercent,
  User,
  X,
} from "lucide-react";
import { FaqAccordion, type FaqItem } from "@/components/faq-accordion";
import { MasterShell } from "@/components/master-shell";
import {
  MasterCard,
  MasterHero,
  MasterInfoCard,
  masterBtnGhost,
  masterBtnPrimary,
  masterInputClass,
} from "@/components/master-ui";

type HelpCategory = {
  id: string;
  title: string;
  description: string;
  icon: typeof BookOpen;
  href?: string;
  faqs: FaqItem[];
};

const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "Master login, navigation, and daily workflow.",
    icon: BookOpen,
    faqs: [
      {
        question: "How do I log in to the master dashboard?",
        answer:
          "Go to /master-login and sign in with your master admin email and password. After login you land on the Dashboard. Use the left sidebar to jump between Companies, Practice Sessions, Promo Codes, User Analytics, System Settings, and Reports.",
      },
      {
        question: "What is the difference between Dashboard, Logs, Support, and Help Center?",
        answer:
          "Dashboard sections (sidebar) show operational data — companies, sessions, revenue, etc. Logs is a live activity feed of platform events. Support is your inbox for contact-form and company-admin messages. Help Center (this page) explains how everything works.",
      },
      {
        question: "What does the Generate Report button do?",
        answer:
          "It opens the Reports page where you can pick a time range (7d, 30d, 90d, all time), preview platform metrics, and download JSON or CSV for sharing with stakeholders.",
      },
    ],
  },
  {
    id: "companies",
    title: "Company management",
    description: "Onboard employers and monitor hiring activity.",
    icon: Building2,
    href: "/master/companies",
    faqs: [
      {
        question: "How is a new company added?",
        answer:
          "Companies are created when an employer signs up through the company login flow or when you provision them manually. The Companies page lists every tenant with domain, admin email, active status, and session count.",
      },
      {
        question: "A company shows as inactive — what should I do?",
        answer:
          "Check whether the company admin completed onboarding and whether their domain is verified. Inactive companies cannot run new hiring sessions until reactivated.",
      },
    ],
  },
  {
    id: "practice",
    title: "Practice sessions",
    description: "Candidate mock interviews, payments, and promo usage.",
    icon: ScrollText,
    href: "/master/practice-sessions",
    faqs: [
      {
        question: "What is the difference between a practice session and a company session?",
        answer:
          "Practice sessions are self-serve mock interviews for individual candidates (often paid or promo). Company sessions are employer-led interviews tied to a hiring requirement and invite link.",
      },
      {
        question: "A LIVE session is stuck — what should I check?",
        answer:
          "Open Practice Sessions, set the Status filter to LIVE, and click Search. Check the candidate email and domain. If scoring is pending, wait for the scorecard job or check Logs for errors. Very old LIVE rows may need cleanup from Stuck Sessions.",
      },
      {
        question: "How do I track promo code redemptions?",
        answer:
          "Practice Sessions show whether a session used a promo code or payment. Reports also include promo redemption counts and active promo codes for the selected period.",
      },
    ],
  },
  {
    id: "promo",
    title: "Promo codes",
    description: "Free or discounted practice access for campaigns.",
    icon: TicketPercent,
    href: "/master/promo-codes",
    faqs: [
      {
        question: "How do I create a promo code?",
        answer:
          "On Promo Codes, click create and set a unique code, duration in minutes, and active flag. Candidates enter the code on the practice checkout screen before starting a session.",
      },
      {
        question: "The code is not working — common reasons?",
        answer:
          "The code may be inactive, expired by policy, already used per your limits, or typed with wrong casing. Confirm isActive is true and the code matches exactly.",
      },
    ],
  },
  {
    id: "analytics",
    title: "User analytics",
    description: "Directory of users and engagement signals.",
    icon: BarChart3,
    href: "/master/user-analytics",
    faqs: [
      {
        question: "What does the User Analytics page show?",
        answer:
          "A searchable directory of candidates and admins with session counts, last activity, and signup source. Use it to find heavy users, debug account issues, or spot drop-off.",
      },
    ],
  },
  {
    id: "settings",
    title: "System settings",
    description: "Environment and integration health checks.",
    icon: Settings,
    href: "/master/system-settings",
    faqs: [
      {
        question: "What does System Settings show?",
        answer:
          "A read-only health dashboard for OpenAI, Razorpay, SMTP, database, S3/storage, and auth secrets. Red items mean a required env var is missing before production launch.",
      },
      {
        question: "Can I change settings from here?",
        answer:
          "No — values are masked and read-only. Update .env on the server, redeploy, then refresh this page to confirm the check turns green.",
      },
    ],
  },
  {
    id: "reports",
    title: "Reports & exports",
    description: "Downloadable snapshots for leadership.",
    icon: FileBarChart,
    href: "/master/reports",
    faqs: [
      {
        question: "Which metrics are included in a report?",
        answer:
          "Company counts, session breakdown (practice vs company), completion rate, practice revenue, paying users, promo stats, support inquiry summary, top domains, weekly trend, and recent practice highlights.",
      },
      {
        question: "JSON vs CSV — when should I use each?",
        answer:
          "JSON keeps nested structure for engineers or BI pipelines. CSV is better for Excel/Sheets and quick sharing with non-technical stakeholders.",
      },
    ],
  },
  {
    id: "support",
    title: "Support & contact",
    description: "Handle inbound messages from users and admins.",
    icon: LifeBuoy,
    href: "/master/support",
    faqs: [
      {
        question: "Which messages appear in the support inbox?",
        answer:
          "Messages from the public /contact form (PUBLIC_CONTACT) and support requests sent from a company admin dashboard (COMPANY_ADMIN). Each row shows name, email, subject, and full message.",
      },
      {
        question: "What is the status workflow?",
        answer:
          "NEW → unread. Mark READ when reviewed. Mark REPLIED after you email the user back. ARCHIVED when closed. Status updates are for your team's tracking only.",
      },
      {
        question: "How do I email a user directly?",
        answer:
          "Open an inquiry, click the email address to open your mail client, reply from your support inbox, then mark the ticket as REPLIED.",
      },
    ],
  },
];

const QUICK_LINKS = [
  { label: "Dashboard", href: "/master/dashboard", icon: BookOpen },
  { label: "Payments", href: "/master/payments", icon: CreditCard },
  { label: "Security", href: "/master/security", icon: Shield },
  { label: "Companies", href: "/master/companies", icon: Building2 },
  { label: "Practice Sessions", href: "/master/practice-sessions", icon: ScrollText },
  { label: "Promo Codes", href: "/master/promo-codes", icon: TicketPercent },
  { label: "User Analytics", href: "/master/user-analytics", icon: BarChart3 },
  { label: "System Settings", href: "/master/system-settings", icon: Settings },
  { label: "Reports", href: "/master/reports", icon: FileBarChart },
  { label: "Support inbox", href: "/master/support", icon: Mail },
  { label: "Activity logs", href: "/master/logs", icon: ScrollText },
  { label: "Profile", href: "/master/profile", icon: User },
];

export default function MasterHelpCenterPage() {
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(HELP_CATEGORIES[0]!.id);

  const filteredCategories = useMemo(() => {
    const query = appliedSearch.toLowerCase();
    if (!query) return HELP_CATEGORIES;

    return HELP_CATEGORIES.map((category) => ({
      ...category,
      faqs: category.faqs.filter(
        (faq) =>
          faq.question.toLowerCase().includes(query) ||
          faq.answer.toLowerCase().includes(query) ||
          category.title.toLowerCase().includes(query) ||
          category.description.toLowerCase().includes(query),
      ),
    })).filter((category) => category.faqs.length > 0);
  }, [appliedSearch]);

  const selectedCategory =
    filteredCategories.find((category) => category.id === activeCategory) ?? filteredCategories[0];

  const totalMatchingArticles = filteredCategories.reduce((sum, category) => sum + category.faqs.length, 0);

  function applySearch() {
    const query = searchInput.trim();
    setAppliedSearch(query);

    if (!query) {
      setActiveCategory(HELP_CATEGORIES[0]!.id);
      return;
    }

    const matches = HELP_CATEGORIES.map((category) => ({
      ...category,
      faqs: category.faqs.filter(
        (faq) =>
          faq.question.toLowerCase().includes(query.toLowerCase()) ||
          faq.answer.toLowerCase().includes(query.toLowerCase()) ||
          category.title.toLowerCase().includes(query.toLowerCase()) ||
          category.description.toLowerCase().includes(query.toLowerCase()),
      ),
    })).filter((category) => category.faqs.length > 0);

    if (matches[0]) {
      setActiveCategory(matches[0].id);
    }
  }

  function clearSearch() {
    setSearchInput("");
    setAppliedSearch("");
    setActiveCategory(HELP_CATEGORIES[0]!.id);
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      applySearch();
    }
  }

  return (
    <MasterShell
      title="Help Center"
      subtitle="Master admin guides, FAQs, and quick links — all in one place."
    >
      <div className="space-y-5">
        <MasterHero
          badge="Knowledge base"
          title="What is the Help Center?"
          subtitle="Internal guides for the Uhired master dashboard — short guides for each section, common questions, and direct links so you can confidently manage companies, sessions, promo codes, reports, and support."
        />

        <MasterCard
          title="Search help articles"
          subtitle="Find answers across all topics, FAQs, and quick links."
        >
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <label className="block space-y-1.5">
                <span className="admin-label">Search guides</span>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Topic, question, or keyword..."
                    className={`${masterInputClass} w-full pl-10`}
                  />
                </div>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applySearch}
                  className={`${masterBtnPrimary} inline-flex items-center gap-2 !px-5`}
                >
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Search
                </button>
                {appliedSearch ? (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className={`${masterBtnGhost} inline-flex items-center gap-2 !px-4`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Clear
                  </button>
                ) : null}
              </div>
            </div>

            {appliedSearch ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/80 pt-4">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Active filters
                </span>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                  Search: {appliedSearch}
                </span>
                <span className="text-xs text-slate-500">
                  {totalMatchingArticles} article{totalMatchingArticles === 1 ? "" : "s"} in{" "}
                  {filteredCategories.length} topic{filteredCategories.length === 1 ? "" : "s"}
                </span>
              </div>
            ) : null}
          </div>
        </MasterCard>

        <MasterCard title="Quick links" subtitle="Jump directly to any master dashboard section.">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-sm font-semibold text-[#0f172a] transition hover:border-emerald-200 hover:bg-emerald-50/50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <link.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {link.label}
              </Link>
            ))}
          </div>
        </MasterCard>

        <div className="flex flex-col gap-5 lg:flex-row">
          <aside className="lg:w-72 lg:shrink-0">
            <MasterCard title="Topics" subtitle="Browse help by section.">
              <div className="space-y-1">
                {filteredCategories.map((category) => {
                  const active = selectedCategory?.id === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setActiveCategory(category.id)}
                      className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                        active
                          ? "bg-emerald-50 font-semibold text-[#0f172a] ring-1 ring-emerald-200/80"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <category.icon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-emerald-600" : "text-slate-400"}`}
                        aria-hidden="true"
                      />
                      <span>
                        {category.title}
                        <span className="mt-0.5 block text-xs font-normal text-slate-500">
                          {category.faqs.length} article{category.faqs.length === 1 ? "" : "s"}
                        </span>
                      </span>
                    </button>
                  );
                })}
                {!filteredCategories.length ? (
                  <p className="px-3 py-4 text-sm text-slate-500">No topics match your search.</p>
                ) : null}
              </div>
            </MasterCard>
          </aside>

          <div className="min-w-0 flex-1">
            {selectedCategory ? (
              <MasterCard
                title={selectedCategory.title}
                subtitle={selectedCategory.description}
                headerAction={
                  selectedCategory.href ? (
                    <Link href={selectedCategory.href} className={`${masterBtnPrimary} !px-3 !py-2 !text-xs`}>
                      Open {selectedCategory.title}
                    </Link>
                  ) : null
                }
              >
                <FaqAccordion items={selectedCategory.faqs} />
              </MasterCard>
            ) : (
              <MasterCard title="No matching articles" subtitle="Try a different search term or clear filters.">
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-slate-700">Nothing found for your search</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Browse topics on the left or clear your search to see all guides.
                  </p>
                  {appliedSearch ? (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className={`${masterBtnGhost} mt-4 inline-flex items-center gap-2`}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      Clear search
                    </button>
                  ) : null}
                </div>
              </MasterCard>
            )}
          </div>
        </div>

        <MasterInfoCard title="Still need help?">
          <p className="text-sm leading-relaxed text-slate-600">
            For messages from platform users, open the{" "}
            <Link href="/master/support" className="font-semibold text-emerald-600 hover:underline">
              Support inbox
            </Link>
            . For technical issues, check{" "}
            <Link href="/master/logs" className="font-semibold text-emerald-600 hover:underline">
              Logs
            </Link>
            , or verify integration health in{" "}
            <Link href="/master/system-settings" className="font-semibold text-emerald-600 hover:underline">
              System Settings
            </Link>
            .
          </p>
        </MasterInfoCard>
      </div>
    </MasterShell>
  );
}
