"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Building2, LifeBuoy, ScrollText, Search, TicketPercent } from "lucide-react";

type SearchResult = {
  id: string;
  type: "company" | "session" | "support" | "promo";
  title: string;
  subtitle: string;
  meta: string;
  href: string;
};

const TYPE_ICONS = {
  company: Building2,
  session: ScrollText,
  support: LifeBuoy,
  promo: TicketPercent,
};

export function MasterGlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/master/search?q=${encodeURIComponent(query.trim())}`);
          if (!res.ok) return;
          const payload = (await res.json()) as { results: SearchResult[] };
          setResults(payload.results ?? []);
          setOpen(true);
        } finally {
          setLoading(false);
        }
      })();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => {
          if (results.length) setOpen(true);
        }}
        placeholder="Search companies, sessions, promo codes…"
        className="admin-header-search w-full"
        aria-label="Global platform search"
        autoComplete="off"
      />
      {open ? (
        <div className="admin-card absolute left-0 right-0 z-50 mt-2 max-h-80 overflow-y-auto !rounded-xl !p-0 shadow-xl ring-1 ring-border">
          {loading ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Searching…</p>
          ) : results.length ? (
            <ul>
              {results.map((result) => {
                const Icon = TYPE_ICONS[result.type];
                return (
                  <li key={result.id} className="border-b border-border last:border-0">
                    <Link
                      href={result.href}
                      onClick={() => {
                        setOpen(false);
                        setQuery("");
                      }}
                      className="flex items-start gap-3 px-4 py-3 no-underline transition hover:bg-surface/60"
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{result.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{result.subtitle}</p>
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {result.meta}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">No results for &quot;{query}&quot;</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
