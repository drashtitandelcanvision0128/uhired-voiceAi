import type { ReactNode } from "react";
import { Eyebrow, Orb } from "./shared";

export function PageHero({
  eyebrow,
  title,
  highlight,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  highlight?: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border-b border-border">
      <Orb className="-top-24 -left-24 h-[360px] w-[360px] opacity-30" />
      <Orb className="top-10 -right-32 h-[320px] w-[320px] opacity-25" tone="violet" />
      <div aria-hidden="true" className="neural-grid absolute inset-0 opacity-40" />
      <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-28 sm:px-8 sm:pb-20 sm:pt-32">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-6xl">
          {title}{" "}
          {highlight ? <span className="text-gradient">{highlight}</span> : null}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {description}
        </p>
        {children ? <div className="mt-8 flex flex-wrap gap-3">{children}</div> : null}
      </div>
    </div>
  );
}
