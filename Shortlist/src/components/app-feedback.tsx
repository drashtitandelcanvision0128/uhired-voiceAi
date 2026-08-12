"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Info, Loader2, Trash2, X, XCircle } from "lucide-react";

/* ─── Toast ─── */

type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: string;
  variant: ToastVariant;
  message: string;
  duration: number;
};

type ToastContextValue = {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const;

const TOAST_STYLES = {
  success: "border-emerald-500/30 bg-[#0f172a] text-emerald-50 shadow-black/40",
  error: "border-red-500/30 bg-[#0f172a] text-red-50 shadow-black/40",
  info: "border-sky-500/30 bg-[#0f172a] text-sky-50 shadow-black/40",
} as const;

const TOAST_ICON_STYLES = {
  success: "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30",
  error: "bg-red-500/15 text-red-400 ring-1 ring-red-500/30",
  info: "bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30",
} as const;

const TOAST_PROGRESS_STYLES = {
  success: "bg-emerald-500",
  error: "bg-red-500",
  info: "bg-sky-500",
} as const;

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  if (!toasts.length) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-[min(100vw-2rem,24rem)] flex-col gap-3"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const Icon = TOAST_ICONS[toast.variant];
        return (
          <ToastCard key={toast.id} toast={toast} Icon={Icon} onDismiss={onDismiss} />
        );
      })}
    </div>
  );
}

function ToastCard({
  toast,
  Icon,
  onDismiss,
}: {
  toast: ToastItem;
  Icon: typeof CheckCircle2;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const enterFrame = requestAnimationFrame(() => setVisible(true));
    const start = Date.now();
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / toast.duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        window.clearInterval(tick);
      }
    }, 50);

    const timer = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(() => onDismiss(toast.id), 200);
    }, toast.duration);

    return () => {
      cancelAnimationFrame(enterFrame);
      window.clearInterval(tick);
      window.clearTimeout(timer);
    };
  }, [toast.duration, toast.id, onDismiss]);

  return (
    <div
      role="status"
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border shadow-xl shadow-black/30 transition-all duration-200 ${TOAST_STYLES[toast.variant]} ${
        visible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
      }`}
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <div
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${TOAST_ICON_STYLES[toast.variant]}`}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <p className="min-w-0 flex-1 pt-1.5 text-sm font-semibold leading-snug">{toast.message}</p>
        <button
          type="button"
          onClick={() => {
            setVisible(false);
            window.setTimeout(() => onDismiss(toast.id), 200);
          }}
          className="mt-0.5 rounded-lg p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="h-1 w-full bg-slate-800">
        <div
          className={`h-full transition-[width] duration-75 ease-linear ${TOAST_PROGRESS_STYLES[toast.variant]}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((variant: ToastVariant, message: string, duration = 4000) => {
    const id = `toast-${++idRef.current}`;
    setToasts((current) => [...current.slice(-4), { id, variant, message, duration }]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message, duration) => push("success", message, duration),
      error: (message, duration) => push("error", message, duration),
      info: (message, duration) => push("info", message, duration),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within AppFeedbackProvider");
  }
  return ctx;
}

/* ─── Confirm dialog ─── */

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
};

export type ConfirmDeleteOptions = {
  /** e.g. "company", "session", "promo code" */
  item?: string;
  /** Named item → title becomes Delete "Acme Corp"? */
  itemName?: string;
  /** Override auto-generated title */
  title?: string;
  /** Override auto-generated message */
  message?: string;
  /** Bulk delete count (default 1) */
  count?: number;
  confirmLabel?: string;
};

type ConfirmState = ConfirmOptions & { open: true };

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

function ConfirmDialog({
  state,
  busy,
  onCancel,
  onConfirm,
}: {
  state: ConfirmState;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isDanger = state.variant === "danger";
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onCancel]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        aria-label="Close dialog"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="app-confirm-modal relative w-full max-w-[28rem] animate-[confirmIn_0.22s_ease-out] overflow-hidden rounded-2xl border border-slate-600/60 bg-[#0f172a] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
      >
        <div className="relative border-b border-slate-700/70 bg-gradient-to-br from-slate-800/90 via-[#0f172a] to-[#0f172a] px-6 py-5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-red-500/10 blur-2xl" />
          <div className="relative flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                isDanger
                  ? "bg-red-500/15 text-red-400 ring-1 ring-red-500/30"
                  : "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30"
              }`}
            >
              {isDanger ? <Trash2 className="h-5 w-5" aria-hidden /> : <AlertTriangle className="h-5 w-5" aria-hidden />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                {isDanger ? "Confirm deletion" : "Please confirm"}
              </p>
              <h2 id="confirm-dialog-title" className="mt-1.5 text-xl font-extrabold tracking-tight text-white">
                {state.title}
              </h2>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          <p id="confirm-dialog-desc" className="text-sm leading-relaxed text-slate-300">
            {state.message}
          </p>
          {isDanger ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden />
              <p className="text-xs font-medium leading-relaxed text-red-300">
                This action is permanent and cannot be undone.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2.5 border-t border-slate-700/70 bg-slate-900/50 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="inline-flex w-full items-center justify-center rounded-xl border border-slate-600 bg-slate-800/80 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-700/80 sm:w-auto disabled:opacity-60"
          >
            {state.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition sm:w-auto disabled:opacity-60 ${
              isDanger
                ? "bg-red-600 shadow-lg shadow-red-900/40 hover:bg-red-500"
                : "bg-emerald-600 shadow-lg shadow-emerald-900/30 hover:bg-emerald-500"
            }`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {state.confirmLabel ?? (isDanger ? "Yes, delete" : "Confirm")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ ...options, open: true });
      setBusy(false);
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setState(null);
    setBusy(false);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state ? (
        <ConfirmDialog
          state={state}
          busy={busy}
          onCancel={() => close(false)}
          onConfirm={() => {
            setBusy(true);
            close(true);
          }}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within AppFeedbackProvider");
  }
  return ctx;
}

/**
 * Single hook for toasts + confirm dialogs across the app.
 *
 * @example
 * const { confirmDelete, notify } = useAppFeedback();
 *
 * const ok = await confirmDelete({ item: "session" });
 * if (!ok) return;
 * // ... delete API call ...
 * notify.deleted("Session");
 */
export function useAppFeedback() {
  const toast = useToast();
  const confirm = useConfirm();

  const confirmDelete = useCallback(
    async (opts: ConfirmDeleteOptions = {}) => {
      const count = opts.count ?? 1;
      const item = opts.item ?? "item";
      const plural = count === 1 ? item : `${item}s`;

      const title =
        opts.title ??
        (opts.itemName
          ? `Delete "${opts.itemName}"?`
          : `Delete ${count > 1 ? `${count} ` : ""}${plural}?`);

      const message =
        opts.message ??
        (count > 1
          ? `This permanently removes ${count} ${plural} and all related data.`
          : `This permanently removes this ${item} and all related data.`);

      const confirmLabel =
        opts.confirmLabel ?? (count > 1 ? `Delete ${count} ${plural}` : `Delete ${item}`);

      return confirm({ title, message, confirmLabel, variant: "danger" });
    },
    [confirm],
  );

  const confirmAction = useCallback(
    (opts: ConfirmOptions) => confirm(opts),
    [confirm],
  );

  const notify = useMemo(
    () => ({
      success: toast.success,
      error: toast.error,
      info: toast.info,
      created: (what: string) => toast.success(`${what} created successfully.`),
      updated: (what: string) => toast.success(`${what} updated successfully.`),
      deleted: (what: string) => toast.success(`${what} deleted successfully.`),
      saved: (what = "Changes") => toast.success(`${what} saved successfully.`),
    }),
    [toast],
  );

  return { toast, confirm, confirmDelete, confirmAction, notify };
}

/* ─── Combined provider ─── */

export function AppFeedbackProvider({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
