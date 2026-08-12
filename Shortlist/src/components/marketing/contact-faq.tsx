"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQ_ITEMS = [
  {
    question: "How does the AI coaching work?",
    answer:
      "Our AI simulates realistic interview scenarios based on your target role and company. It asks questions, evaluates your responses, and provides real-time feedback to help you improve.",
  },
  {
    question: "Can I customize practice scenarios?",
    answer:
      "Yes! You can choose your target role, company, interview type, and difficulty level to create personalized practice sessions tailored to your goals.",
  },
  {
    question: "Is my data secure and private?",
    answer:
      "Absolutely. We use enterprise-grade encryption and never share your session data with third parties. Your practice sessions and personal information remain strictly confidential.",
  },
] as const;

export function ContactFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {FAQ_ITEMS.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={item.question}
            className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-muted/50"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-semibold text-foreground md:text-base">
                {item.question}
              </span>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {isOpen ? (
              <div className="border-t border-border px-6 pb-5 pt-4">
                <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
                  {item.answer}
                </p>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
