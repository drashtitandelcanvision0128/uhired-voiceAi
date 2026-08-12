"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Fade/rise in when scrolled into view. */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = "div",
  from = "up",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li";
  from?: "up" | "left" | "right" | "zoom";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "-60px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Comp = Tag as "div";
  const anim = {
    up: "animate-rise",
    left: "animate-rise-left",
    right: "animate-rise-right",
    zoom: "animate-zoom-in",
  }[from];
  return (
    <Comp
      ref={ref}
      className={cn(shown ? anim : "opacity-0", className)}
      style={shown && delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Comp>
  );
}

/** Types out text then blinks a caret. */
export function Typewriter({
  words,
  className,
}: {
  words: string[];
  className?: string;
}) {
  const [i, setI] = useState(0);
  const [len, setLen] = useState(0);
  const [back, setBack] = useState(false);

  useEffect(() => {
    const word = words[i % words.length] ?? "";
    if (!back && len === word.length) {
      const t = setTimeout(() => setBack(true), 1500);
      return () => clearTimeout(t);
    }
    if (back && len === 0) {
      setBack(false);
      setI((v) => (v + 1) % words.length);
      return;
    }
    const t = setTimeout(() => setLen((v) => v + (back ? -1 : 1)), back ? 34 : 68);
    return () => clearTimeout(t);
  }, [len, back, i, words]);

  return (
    <span className={cn("inline-flex items-baseline", className)}>
      <span className="text-gradient">{(words[i % words.length] ?? "").slice(0, len)}</span>
      <span className="animate-caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.08em] bg-cyan" />
    </span>
  );
}

/** Infinite horizontal scroller (content duplicated for a seamless loop). */
export function Marquee({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("group relative overflow-hidden", className)}
      style={{
        maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <div className="animate-marquee flex w-max gap-4 group-hover:[animation-play-state:paused]">
        <div className="flex shrink-0 gap-4">{children}</div>
        <div aria-hidden="true" className="flex shrink-0 gap-4">
          {children}
        </div>
      </div>
    </div>
  );
}

/** Soft glowing orb used as ambient background motion. */
export function Orb({ className, tone = "primary" }: { className?: string; tone?: "primary" | "cyan" | "violet" }) {
  const tones = { primary: "var(--primary)", cyan: "var(--cyan)", violet: "var(--violet)" } as const;
  return (
    <div
      aria-hidden="true"
      className={cn("animate-glow-pulse pointer-events-none absolute rounded-full blur-3xl", className)}
      style={{ background: `radial-gradient(circle, color-mix(in oklab, ${tones[tone]} 55%, transparent), transparent 70%)` }}
    />
  );
}

/** 3D tilt-on-hover wrapper. */
export function Tilt({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ x: 0, y: 0 });
  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        setT({
          x: ((e.clientY - r.top) / r.height - 0.5) * -6,
          y: ((e.clientX - r.left) / r.width - 0.5) * 6,
        });
      }}
      onMouseLeave={() => setT({ x: 0, y: 0 })}
      className={cn("transition-transform duration-300 ease-out [transform-style:preserve-3d]", className)}
      style={{ transform: `perspective(1200px) rotateX(${t.x}deg) rotateY(${t.y}deg)` }}
    >
      {children}
    </div>
  );
}

export function Section({
  id,
  children,
  className,
  tight,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tight?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn("relative scroll-mt-24", tight ? "py-14 sm:py-16" : "py-20 sm:py-28", className)}
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 font-mono text-[11px] tracking-[0.2em] text-accent uppercase">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      {children}
    </span>
  );
}

export function SectionHead({
  eyebrow,
  title,
  highlight,
  description,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  highlight?: string;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <Reveal className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="mt-5 text-3xl leading-[1.1] font-semibold sm:text-4xl lg:text-5xl">
        {title} {highlight ? <span className="text-gradient">{highlight}</span> : null}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p>
      ) : null}
    </Reveal>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("glass rounded-2xl", className)}
      style={{ boxShadow: "var(--shadow-panel)" }}
    >
      {children}
    </div>
  );
}

export function Card({
  children,
  className,
  interactive = true,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div className={cn("glass rounded-2xl p-6", interactive && "glow-card", className)}>{children}</div>
  );
}

export function IconBadge({ children, tone = "primary" }: { children: ReactNode; tone?: "primary" | "cyan" | "violet" }) {
  const tones = {
    primary: "text-primary border-primary/40 bg-primary/12",
    cyan: "text-cyan border-cyan/40 bg-cyan/12",
    violet: "text-violet border-violet/40 bg-violet/12",
  } as const;
  return (
    <span className={cn("inline-grid h-11 w-11 shrink-0 place-items-center rounded-xl border", tones[tone])}>
      {children}
    </span>
  );
}

/** Animated voice waveform bars. */
export function Waveform({
  bars = 32,
  className,
  active = true,
}: {
  bars?: number;
  className?: string;
  active?: boolean;
}) {
  const heights = Array.from({ length: bars }, (_, i) => 24 + Math.abs(Math.sin(i * 0.7)) * 68);
  return (
    <div className={cn("flex h-16 items-center gap-[3px]", className)} aria-hidden="true">
      {heights.map((h, i) => (
        <span
          key={i}
          className={cn(
            "flex-1 rounded-full bg-gradient-to-t from-primary/40 via-primary to-cyan",
            active && "animate-wave",
          )}
          style={{
            height: `${h}%`,
            animationDelay: `${(i % 9) * 90}ms`,
            animationDuration: `${900 + (i % 5) * 120}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function StatusDot({ tone = "success" }: { tone?: "success" | "primary" | "warning" }) {
  const tones = { success: "bg-success", primary: "bg-primary", warning: "bg-warning" } as const;
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className={cn("absolute inset-0 rounded-full", tones[tone], "animate-pulse-ring")} />
      <span className={cn("relative h-2 w-2 rounded-full", tones[tone])} />
    </span>
  );
}

/** Score meter that animates to value on reveal. */
export function ScoreBar({
  label,
  value,
  tone = "primary",
}: {
  label: string;
  value: number;
  tone?: "primary" | "cyan" | "violet";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (e[0]?.isIntersecting) {
        setW(value);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [value]);
  const tones = {
    primary: "from-primary to-cyan",
    cyan: "from-cyan to-primary",
    violet: "from-violet to-primary",
  } as const;
  return (
    <div ref={ref}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{value}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-1000 ease-out", tones[tone])}
          style={{ width: `${w}%` }}
        />
      </div>
    </div>
  );
}

/** Counts up to `to` when scrolled into view. */
export function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / 1100);
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [to]);
  return (
    <span ref={ref} className="font-mono">
      {n}
      {suffix}
    </span>
  );
}

export function Aurora({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("aurora pointer-events-none absolute opacity-40", className)} />;
}

export function ButtonLink({
  children,
  href,
  to,
  variant = "primary",
  className,
}: {
  children: ReactNode;
  href?: string;
  to?: string;
  variant?: "primary" | "ghost";
  className?: string;
}) {
  const cls = cn(
    "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-300",
    variant === "primary"
      ? "text-primary-foreground hover:-translate-y-0.5"
      : "border border-border bg-surface/60 text-foreground hover:border-primary/50 hover:bg-surface",
    className,
  );
  const style =
    variant === "primary"
      ? { background: "var(--gradient-brand)", boxShadow: "var(--shadow-glow)" }
      : undefined;

  if (to) {
    return (
      <Link href={to} className={cls} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href ?? "#"} className={cls} style={style}>
      {children}
    </a>
  );
}