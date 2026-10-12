"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md bg-[var(--color-navy)] px-4 py-2 text-sm font-semibold text-white print:hidden"
    >
      {label}
    </button>
  );
}
