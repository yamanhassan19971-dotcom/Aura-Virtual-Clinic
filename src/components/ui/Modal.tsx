"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export function Modal({
  title,
  onClose,
  children,
  width = "md",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const widthClass = width === "sm" ? "max-w-sm" : width === "lg" ? "max-w-2xl" : "max-w-md";

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className={`w-full ${widthClass} max-h-[90vh] overflow-auto rounded-lg bg-white shadow-xl`}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3.5">
          <h2 className="text-base font-semibold text-[var(--color-text)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
