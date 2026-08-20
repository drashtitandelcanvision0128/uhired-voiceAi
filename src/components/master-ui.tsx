"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  KeyRound,
  MoreVertical,
  PauseCircle,
  Pencil,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { AppSelect, type AppSelectOption } from "@/components/ui/app-select";

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
  accent = "text-muted-foreground",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  accent?: string;
}) {
  return (
    <article className="admin-card flex h-full flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-sm">{label}</p>
        {Icon ? (
          <div className={`flex size-8 shrink-0 items-center justify-center rounded-md ${accent}`}>
            <Icon className="size-4" aria-hidden />
          </div>
        ) : null}
      </div>
      <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint ? <p className="text-muted-foreground text-xs leading-snug">{hint}</p> : null}
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
    <section className="admin-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          {badge ? (
            <p className="text-muted-foreground text-xs font-medium">{badge}</p>
          ) : null}
          <h2 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
          {subtitle ? <p className="text-muted-foreground mt-1.5 text-sm">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
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
  const cardClass = elevated ? "admin-card-elevated" : "admin-card";
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

export type MasterSelectOption = AppSelectOption;
export const MasterSelect = AppSelect;

export const masterBtnPrimary = "admin-btn-primary !text-sm";

export const masterBtnGhost = "admin-btn-ghost !text-sm";

export const masterRowActionClass = "admin-btn-ghost !px-2.5 !py-1 !text-xs";

export const masterRowActionDangerClass =
  "rounded-lg border border-destructive/25 bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive transition hover:bg-destructive/15";

export type MasterRowMenuAction = {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
};

function defaultRowActionIcon(label: string): LucideIcon | undefined {
  const key = label.trim().toLowerCase();
  if (key === "view") return Eye;
  if (key === "edit") return Pencil;
  if (key === "delete") return Trash2;
  if (key === "activate") return CheckCircle2;
  if (key === "deactivate") return PauseCircle;
  if (key === "regen passcode") return KeyRound;
  return undefined;
}

export function MasterRowActionsMenu({
  label,
  actions,
}: {
  label: string;
  actions: Array<MasterRowMenuAction | false | null | undefined>;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const items = actions.filter((item): item is MasterRowMenuAction => Boolean(item));

  function placeMenu() {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = 176;
    const height = items.length * 36 + 8;
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const openUp = rect.bottom + height > window.innerHeight - 8;
    const top = openUp ? Math.max(8, rect.top - height - 4) : rect.bottom + 4;
    setCoords({ top, left });
  }

  useEffect(() => {
    if (!open) return;
    placeMenu();
    function onDocClick(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onDismiss() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("scroll", onDismiss, true);
    window.addEventListener("resize", onDismiss);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("scroll", onDismiss, true);
      window.removeEventListener("resize", onDismiss);
    };
  }, [open, items.length]);

  if (items.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-7 items-center justify-center rounded-md"
        aria-label={`Actions for ${label}`}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          if (open) {
            setOpen(false);
            return;
          }
          placeMenu();
          setOpen(true);
        }}
      >
        <MoreVertical className="size-4" />
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="bg-popover text-popover-foreground fixed z-[80] min-w-44 overflow-hidden rounded-md border py-1 shadow-lg"
              style={{ top: coords.top, left: coords.left }}
            >
              {items.map((item) => {
                const Icon = item.icon ?? defaultRowActionIcon(item.label);
                return (
                  <button
                    key={item.label}
                    type="button"
                    disabled={item.disabled}
                    className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm disabled:opacity-50 ${
                      item.danger
                        ? "text-destructive hover:bg-destructive/10"
                        : "hover:bg-muted"
                    }`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpen(false);
                      item.onClick();
                    }}
                  >
                    {Icon ? <Icon className="size-3.5" /> : null}
                    {item.label}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export const MASTER_SESSION_STATUS_STYLES: Record<string, string> = {
  LIVE: "bg-destructive/12 text-destructive ring-destructive/25",
  READY: "bg-primary/12 text-primary ring-primary/25",
  COMPLETED: "bg-success/12 text-success ring-success/25",
};

export function formatMasterStatus(status: string) {
  if (status === "LIVE") return "Live";
  if (status === "READY") return "Ready";
  if (status === "COMPLETED") return "Completed";
  if (!status) return "—";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

export function MasterStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ${
        MASTER_SESSION_STATUS_STYLES[status] ?? "bg-surface/80 text-muted-foreground ring-border"
      }`}
    >
      {formatMasterStatus(status)}
    </span>
  );
}

export function MasterInlineKpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/60 px-3 py-2">
      <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-[0.14em]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
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
  presentation = "modal",
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
  presentation?: "modal" | "page";
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const maxWidth =
    size === "xl" ? "max-w-5xl" : size === "md" ? "max-w-2xl" : "max-w-4xl";

  useEffect(() => {
    if (!open || presentation === "page") return;
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
  }, [open, onClose, loading, presentation]);

  if (!open) return null;

  if (presentation === "page") {
    return (
      <section className="space-y-3">
        <div className="admin-card px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1.5 text-xs font-medium disabled:opacity-50"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Back
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id={ariaLabelledBy}
                  className="text-lg font-semibold tracking-tight text-foreground"
                >
                  {title}
                </h2>
                {badges}
              </div>
              {subtitle ? (
                <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
              ) : null}
            </div>
            {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
          </div>
        </div>
        <div>{children}</div>
      </section>
    );
  }

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
        className={`master-shell admin-card-elevated relative flex ${maxWidth} w-full max-h-[92vh] flex-col overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.45)] animate-[confirmIn_0.22s_ease-out]`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-border bg-gradient-to-br from-primary/10 via-card to-primary/5 px-5 py-4 sm:px-6">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-6 left-1/3 h-24 w-24 rounded-full bg-primary/8 blur-2xl" />
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
