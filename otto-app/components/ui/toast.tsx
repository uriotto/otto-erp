"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => remove(id), 3500);
    },
    [remove],
  );

  const success = useCallback((message: string) => show(message, "success"), [show]);
  const error = useCallback((message: string) => show(message, "error"), [show]);

  const value = useMemo(() => ({ show, success, error }), [show, success, error]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const styles: Record<ToastVariant, string> = {
    success: "bg-emerald-600 text-white border-emerald-500",
    error: "bg-rose-600 text-white border-rose-500",
    info: "bg-navy text-cream border-navy/60",
  };

  return (
    <button
      type="button"
      onClick={onDismiss}
      className={`pointer-events-auto max-w-md min-w-[260px] rounded-xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-sm transition-all duration-200 ${
        styles[toast.variant]
      } ${visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
    >
      {toast.message}
    </button>
  );
}
