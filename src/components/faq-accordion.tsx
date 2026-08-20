"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export type FaqItem = {
  question: string;
  answer: string;
};

type FaqAccordionProps = {
  items: FaqItem[];
  className?: string;
  compact?: boolean;
};

export function FaqAccordion({ items, className = "", compact = false }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className={`${compact ? "space-y-2" : "space-y-3"} ${className}`}>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={item.question}
            className={
              compact
                ? "overflow-hidden rounded-lg border border-border bg-card"
                : "glass overflow-hidden rounded-xl"
            }
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className={`flex w-full items-center justify-between gap-3 text-left text-foreground transition-colors hover:text-primary ${
                compact ? "px-3 py-2.5" : "px-5 py-4"
              }`}
              aria-expanded={isOpen}
            >
              <span className={`font-semibold ${compact ? "text-sm" : "text-sm md:text-base"}`}>
                {item.question}
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-primary transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {isOpen ? (
              <div className={`border-t border-border ${compact ? "px-3 pb-3 pt-2" : "px-5 pb-4 pt-3"}`}>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
