import { AudioLines } from "lucide-react";

type AdminPortalLogoProps = {
  subtitle?: string;
};

/**
 * Sidebar brand lockup — uses explicit light/dark text colors so "Uhired" stays
 * readable on the light sidebar (utilities beat component-layer color rules).
 */
export function AdminPortalLogo({ subtitle }: AdminPortalLogoProps) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-primary-foreground shadow-lg"
        style={{ background: "var(--gradient-brand)", boxShadow: "var(--shadow-glow)" }}
        aria-hidden
      >
        <AudioLines className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <span className="font-display block text-base font-extrabold tracking-tight">
          <span className="text-slate-900 dark:text-white">Uhired</span>
          <span className="text-gradient"> AI</span>
        </span>
        {subtitle ? (
          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-900 dark:text-slate-400">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
