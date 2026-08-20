"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Building2,
  FileBarChart,
  LifeBuoy,
  ScrollText,
  Search,
  Settings,
  TicketPercent,
  X,
} from "lucide-react";
import { FaqAccordion, type FaqItem } from "@/components/faq-accordion";
import { MasterShell } from "@/components/master-shell";
import { masterBtnGhost, masterBtnPrimary, masterInputClass } from "@/components/master-ui";

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
    description: "Sign in and the left menu.",
    icon: BookOpen,
    faqs: [
      {
        question: "How do I sign in?",
        answer: "Open /master-login. Use your admin email and password.",
      },
      {
        question: "Dashboard vs Logs vs Support vs Help?",
        answer:
          "Dashboard = home numbers. Logs = recent events. Support = website messages. Help = this guide.",
      },
      {
        question: "How do I download numbers?",
        answer: "Open Reports → pick a period → Update → CSV or JSON.",
      },
    ],
  },
  {
    id: "companies",
    title: "Companies",
    description: "Add companies and see their interviews.",
    icon: Building2,
    href: "/master/companies",
    faqs: [
      {
        question: "How do I add a company?",
        answer: "Click Add company. They can also sign up themselves.",
      },
      {
        question: "The company is Inactive. What now?",
        answer: "Open Companies and turn it back on if they should hire again.",
      },
    ],
  },
  {
    id: "practice",
    title: "Practice interviews",
    description: "Candidate mock interviews.",
    icon: ScrollText,
    href: "/master/practice-sessions",
    faqs: [
      {
        question: "Practice vs company interview?",
        answer:
          "Practice is a candidate mock interview (paid or promo). Company interview is for a hiring job.",
      },
      {
        question: "An interview is stuck on Live.",
        answer: "Open Stuck interviews. You can end or delete it there.",
      },
      {
        question: "Where do I see promo use?",
        answer: "On Practice interviews, Payment column. Reports also shows promo uses.",
      },
    ],
  },
  {
    id: "promo",
    title: "Promo codes",
    description: "Free practice interviews.",
    icon: TicketPercent,
    href: "/master/promo-codes",
    faqs: [
      {
        question: "How do I create a code?",
        answer: "Open Promo codes → create a code and minutes. Candidate enters it at checkout.",
      },
      {
        question: "Code is not working.",
        answer: "Check it is Active and typed exactly. Inactive codes will not work.",
      },
    ],
  },
  {
    id: "analytics",
    title: "User analytics",
    description: "People using Uhired.",
    icon: BarChart3,
    href: "/master/user-analytics",
    faqs: [
      {
        question: "What is on this page?",
        answer: "People on Uhired, how many interviews they did, and last activity.",
      },
    ],
  },
  {
    id: "settings",
    title: "Settings",
    description: "Payments, email, and AI.",
    icon: Settings,
    href: "/master/system-settings",
    faqs: [
      {
        question: "What do the colours mean?",
        answer: "Green = connected. Red = missing.",
      },
      {
        question: "Can I edit settings here?",
        answer: "No. Change them on the server, restart, then refresh.",
      },
    ],
  },
  {
    id: "reports",
    title: "Reports",
    description: "Download a date range.",
    icon: FileBarChart,
    href: "/master/reports",
    faqs: [
      {
        question: "What is in a report?",
        answer: "Companies, interviews, completion %, revenue, promos, support, and top tracks.",
      },
      {
        question: "CSV or JSON?",
        answer: "CSV for Excel. JSON for developers.",
      },
    ],
  },
  {
    id: "support",
    title: "Support",
    description: "Messages from the website.",
    icon: LifeBuoy,
    href: "/master/support",
    faqs: [
      {
        question: "Which messages show here?",
        answer: "Contact form messages, and messages from company admins.",
      },
      {
        question: "What do statuses mean?",
        answer: "New = not opened. Read = opened. Replied = emailed. Archived = closed.",
      },
      {
        question: "How do I reply?",
        answer: "Open the row, email them, then mark Replied.",
      },
    ],
  },
];

export default function MasterHelpCenterPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(HELP_CATEGORIES[0]!.id);

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return HELP_CATEGORIES;
    return HELP_CATEGORIES.map((category) => ({
      ...category,
      faqs: category.faqs.filter(
        (faq) =>
          faq.question.toLowerCase().includes(q) ||
          faq.answer.toLowerCase().includes(q) ||
          category.title.toLowerCase().includes(q),
      ),
    })).filter((category) => category.faqs.length > 0);
  }, [query]);

  const selectedCategory =
    filteredCategories.find((category) => category.id === activeCategory) ?? filteredCategories[0];

  return (
    <MasterShell title="Help" subtitle="Short answers for each page.">
      <section className="admin-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search help"
              className={`${masterInputClass} w-full pl-10`}
              aria-label="Search help"
            />
          </div>
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveCategory(HELP_CATEGORIES[0]!.id);
              }}
              className={`${masterBtnGhost} inline-flex h-10 items-center !px-3`}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-col lg:flex-row">
          <aside className="border-b border-border lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r">
            <div className="p-2">
              {filteredCategories.map((category) => {
                const active = selectedCategory?.id === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActiveCategory(category.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm ${
                      active
                        ? "bg-primary/12 font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <category.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate">{category.title}</span>
                  </button>
                );
              })}
              {!filteredCategories.length ? (
                <p className="px-2.5 py-6 text-sm text-muted-foreground">No matches.</p>
              ) : null}
            </div>
          </aside>

          <div className="min-w-0 flex-1 p-3 sm:p-4">
            {selectedCategory ? (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selectedCategory.title}</p>
                    <p className="text-xs text-muted-foreground">{selectedCategory.description}</p>
                  </div>
                  {selectedCategory.href ? (
                    <Link href={selectedCategory.href} className={`${masterBtnPrimary} !px-3 !py-1.5 !text-xs`}>
                      Open
                    </Link>
                  ) : null}
                </div>
                <FaqAccordion items={selectedCategory.faqs} compact />
              </>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Nothing found. Clear search.</p>
            )}
          </div>
        </div>
      </section>
    </MasterShell>
  );
}
