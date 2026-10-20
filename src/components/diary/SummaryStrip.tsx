"use client";

import type { AppointmentStatus } from "@prisma/client";
import { useTranslations } from "next-intl";
import { STATUS_COLOR_VAR, STATUS_GLYPH, STATUS_ORDER } from "@/components/diary/status-meta";

export function SummaryStrip({
  counts,
  total,
  activeFilter,
  onFilterChange,
}: {
  counts: Record<AppointmentStatus, number>;
  total: number;
  activeFilter: AppointmentStatus | null;
  onFilterChange: (status: AppointmentStatus | null) => void;
}) {
  const t = useTranslations("summary");

  return (
    <div className="no-scrollbar flex items-center gap-2 overflow-x-auto whitespace-nowrap border-b border-[var(--color-border)] bg-white px-4 py-2.5 sm:flex-wrap md:px-6">
      <span className="hidden text-xs font-semibold uppercase tracking-wide text-gray-400 sm:inline">{t("title")}</span>
      <button
        type="button"
        onClick={() => onFilterChange(null)}
        className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold ${
          activeFilter === null ? "border-[var(--color-navy)] bg-[var(--color-navy)] text-white" : "border-[var(--color-border)] text-gray-600"
        }`}
      >
        {t("appointments")}: {total}
      </button>
      {STATUS_ORDER.map((status) => {
        const colors = STATUS_COLOR_VAR[status];
        const active = activeFilter === status;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onFilterChange(active ? null : status)}
            className="shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold transition-transform"
            style={{
              borderColor: active ? colors.fg : "var(--color-border)",
              backgroundColor: active ? colors.fg : colors.bg,
              color: active ? "white" : colors.fg,
            }}
          >
            <span aria-hidden className="me-1">
              {STATUS_GLYPH[status]}
            </span>
            {t(status)}: {counts[status]}
          </button>
        );
      })}
    </div>
  );
}
