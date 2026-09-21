"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type Toast = {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
  action?: { label: string; onClick: () => void };
};

type ToastContextValue = {
  show: (message: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"] }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const show = useCallback<ToastContextValue["show"]>((message, opts) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, tone: opts?.tone ?? "info", action: opts?.action }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-3 rounded-md px-4 py-2.5 text-sm font-medium shadow-lg ${
              toast.tone === "error"
                ? "bg-[var(--color-status-fta)] text-white"
                : toast.tone === "success"
                  ? "bg-[var(--color-status-completed)] text-white"
                  : "bg-[var(--color-navy)] text-white"
            }`}
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick();
                  setToasts((prev) => prev.filter((t) => t.id !== toast.id));
                }}
                className="underline underline-offset-2"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
