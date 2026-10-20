"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("common");
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
    // On phones a modal rises from the bottom edge and uses the full width.
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className={`w-full ${widthClass} max-h-[92dvh] overflow-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl sm:max-h-[90vh] sm:rounded-lg sm:pb-0`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border)] bg-white px-4 py-3.5 sm:px-5">
          <h2 className="text-base font-semibold text-[var(--color-text)]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
