import { AudioLines } from "lucide-react";

type AdminPortalLogoProps = {
  title?: string;
  subtitle?: string;
};

/**
 * Sidebar brand lockup — uses explicit light/dark text colors so "Uhired" stays
 * readable on the light sidebar (utilities beat component-layer color rules).
 */
export function AdminPortalLogo({ title = "Uhired", subtitle }: AdminPortalLogoProps) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-full"
        aria-hidden
      >
        <AudioLines className="size-4" />
      </span>
      <div className="min-w-0">
        <span className="block truncate text-sm font-semibold tracking-tight text-foreground">
          {title}
        </span>
        {subtitle ? (
          <p className="text-muted-foreground truncate text-[11px]">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
