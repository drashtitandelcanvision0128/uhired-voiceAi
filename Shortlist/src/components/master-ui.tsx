"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, X, XCircle } from "lucide-react";

export function MasterAlert({
  variant,
  children,
  className = "",
}: {
  variant: "error" | "success";
  children: React.ReactNode;
  className?: string;
}) {
  const isError = variant === "error";
  const styles = isError
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : "border-success/30 bg-success/10 text-success";
  const iconStyles = isError
    ? "bg-destructive/15 text-destructive ring-destructive/25"
    : "bg-success/15 text-success ring-success/25";

  const Icon = isError ? XCircle : CheckCircle2;

  return (
    <div
      role="status"
      className={`admin-card flex items-start gap-3 !rounded-2xl px-4 py-3.5 text-sm font-semibold ${styles} ${className}`}
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ${iconStyles}`}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pt-1 leading-snug">{children}</div>
    </div>
  );
}

export function MasterKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "bg-surface/80 text-muted-foreground ring-border",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  accent?: string;
}) {
  return (
    <article className="admin-card glow-card flex items-start justify-between gap-3 p-5">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-black tracking-tight text-foreground">{value}</p>
        {hint ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
      </div>
      {Icon ? (
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${accent}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      ) : null}
    </article>
  );
}

export function MasterHero({
  badge,
  title,
  subtitle,
  actions,
  children,
}: {
  badge?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="admin-hero relative overflow-hidden rounded-2xl p-5 text-white md:p-6">
      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          {badge ? (
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan">{badge}</p>
          ) : null}
          <h2 className="mt-1 font-display text-xl font-extrabold tracking-tight md:text-2xl">{title}</h2>
          {subtitle ? <p className="mt-2 text-sm text-white/80">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="relative z-10 mt-5">{children}</div> : null}
    </section>
  );
}

export function MasterCard({
  title,
  subtitle,
  children,
  className = "",
  elevated = false,
  headerAction,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
  headerAction?: React.ReactNode;
}) {
  const cardClass = elevated ? "admin-card-elevated glow-card" : "admin-card glow-card";
  return (
    <section className={`${cardClass} p-5 sm:p-6 ${className}`}>
      {title ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="admin-section-title text-lg">{title}</p>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {headerAction}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export const masterTableHeadClass =
  "border-b border-border text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground";

export const masterInputClass = "admin-input !py-2.5 !text-sm";

export const masterBtnPrimary = "admin-btn-primary !text-sm";

export const masterBtnGhost = "admin-btn-ghost !text-sm";

export const masterRowActionClass = "admin-btn-ghost !px-2.5 !py-1 !text-xs";

export const masterRowActionDangerClass =
  "rounded-lg border border-destructive/25 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive transition hover:bg-destructive/15";

export const MASTER_SESSION_STATUS_STYLES: Record<string, string> = {
  LIVE: "bg-destructive/12 text-destructive ring-destructive/25",
  READY: "bg-primary/12 text-primary ring-primary/25",
  COMPLETED: "bg-success/12 text-success ring-success/25",
};

export function MasterStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ring-1 ${
        MASTER_SESSION_STATUS_STYLES[status] ?? "bg-surface/80 text-muted-foreground ring-border"
      }`}
    >
      {status}
    </span>
  );
}

export function MasterInlineKpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

export function MasterInfoCard({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`admin-card glow-card p-4 sm:p-5 ${className}`}>
      {title ? <p className="mb-3 text-sm font-bold text-foreground">{title}</p> : null}
      {children}
    </div>
  );
}

function scoreBarGradient(pct: number) {
  if (pct >= 75) return "bg-gradient-to-r from-emerald-400 to-emerald-500";
  if (pct >= 50) return "bg-gradient-to-r from-cyan-400 to-primary";
  if (pct >= 35) return "bg-gradient-to-r from-amber-400 to-amber-500";
  return "bg-gradient-to-r from-rose-400 to-rose-500";
}

export function MasterScoreBar({
  label,
  value,
  max = 100,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div>
      <div className="mb-1.5 flex justify-between gap-2 text-xs">
        <span className="font-semibold text-muted-foreground">{label}</span>
        <span className="font-bold tabular-nums text-foreground">
          {value}
          {max !== 100 ? `/${max}` : ""}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface/80 ring-1 ring-border">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${scoreBarGradient(pct)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function MasterModal({
  open,
  onClose,
  title,
  subtitle,
  badges,
  headerAction,
  children,
  loading = false,
  size = "lg",
  ariaLabelledBy = "master-modal-title",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  badges?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  size?: "md" | "lg" | "xl";
  ariaLabelledBy?: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const maxWidth =
    size === "xl" ? "max-w-5xl" : size === "md" ? "max-w-2xl" : "max-w-4xl";

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, loading]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99990] flex items-center justify-center p-4 sm:p-6"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-md"
        aria-label="Close modal"
        onClick={() => {
          if (!loading) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        className={`admin-card-elevated glow-card relative flex ${maxWidth} w-full max-h-[92vh] flex-col overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.45)] animate-[confirmIn_0.22s_ease-out]`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-border bg-gradient-to-br from-primary/8 via-surface/40 to-violet/8 px-5 py-4 sm:px-6">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-6 left-1/3 h-24 w-24 rounded-full bg-violet/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id={ariaLabelledBy}
                  className="font-display text-lg font-extrabold tracking-tight text-foreground sm:text-xl"
                >
                  {title}
                </h2>
                {badges}
              </div>
              {subtitle ? (
                <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerAction}
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                disabled={loading}
                className={`${masterBtnGhost} inline-flex items-center gap-1.5 !px-3 !py-1.5 !text-xs disabled:opacity-50`}
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Close
              </button>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
