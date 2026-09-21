import type { AppointmentStatus } from "@prisma/client";
import { useTranslations } from "next-intl";
import { STATUS_COLOR_VAR, STATUS_GLYPH } from "@/components/diary/status-meta";

export function StatusBadge({ status, size = "md" }: { status: AppointmentStatus; size?: "sm" | "md" }) {
  const t = useTranslations("status");
  const colors = STATUS_COLOR_VAR[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
      }`}
      style={{ color: colors.fg, backgroundColor: colors.bg }}
    >
      <span aria-hidden>{STATUS_GLYPH[status]}</span>
      <span>{t(status)}</span>
    </span>
  );
}
