"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { addDays, formatLongDate, startOfDay, toDateParam, type TimeScale } from "@/lib/time";
import { TIME_SCALES } from "@/lib/time";
import type { Practitioner } from "@prisma/client";
import { ChevronIcon } from "@/components/shell/icons";

export function DiaryToolbar({
  date,
  practitioners,
  selectedPractitionerIds,
  onTogglePractitioner,
  onSelectAllPractitioners,
  timeScale,
  onTimeScaleChange,
  onNewAppointment,
  onJumpToNow,
}: {
  date: Date;
  practitioners: Practitioner[];
  selectedPractitionerIds: string[];
  onTogglePractitioner: (id: string) => void;
  onSelectAllPractitioners: () => void;
  timeScale: TimeScale;
  onTimeScaleChange: (scale: TimeScale) => void;
  onNewAppointment: () => void;
  onJumpToNow: () => void;
}) {
  const t = useTranslations("diary");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function goTo(newDate: Date) {
    router.push(`${pathname}?date=${toDateParam(newDate)}`);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.key === "ArrowLeft") goTo(addDays(date, locale === "ar" ? 1 : -1));
      else if (e.key === "ArrowRight") goTo(addDays(date, locale === "ar" ? -1 : 1));
      else if (e.key.toLowerCase() === "t") goTo(startOfDay(new Date()));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, locale]);

  const allSelected = selectedPractitionerIds.length === practitioners.length;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] bg-white px-6 py-3">
      <h1 className="w-full text-lg font-semibold text-[var(--color-navy)] sm:w-auto sm:me-2">{t("title")}</h1>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => goTo(addDays(date, -1))}
          className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-gray-600 hover:bg-gray-50"
          aria-label={t("previousDay")}
        >
          <ChevronIcon className="rtl:rotate-180" width={14} height={14} />
        </button>
        <button
          type="button"
          onClick={() => goTo(startOfDay(new Date()))}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {t("today")}
        </button>
        <button
          type="button"
          onClick={() => goTo(addDays(date, 1))}
          className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-gray-600 hover:bg-gray-50"
          aria-label={t("nextDay")}
        >
          <ChevronIcon className="rotate-180 rtl:rotate-0" width={14} height={14} />
        </button>
        <input
          type="date"
          value={toDateParam(date)}
          onChange={(e) => e.target.value && goTo(new Date(`${e.target.value}T00:00:00`))}
          className="ms-1 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-sm text-gray-600"
        />
      </div>

      <div className="text-sm font-semibold text-[var(--color-navy)]">{formatLongDate(date, locale)}</div>

      <div className="ms-auto flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm text-gray-500">
          {t("timeScale")}
          <select
            value={timeScale}
            onChange={(e) => onTimeScaleChange(Number(e.target.value) as TimeScale)}
            className="rounded-md border border-[var(--color-border)] px-2 py-1 text-sm"
          >
            {TIME_SCALES.map((s) => (
              <option key={s} value={s}>
                {s} min
              </option>
            ))}
          </select>
        </label>

        <details className="relative">
          <summary className="cursor-pointer list-none rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
            {t("practitioners")} ({allSelected ? t("allPractitioners") : selectedPractitionerIds.length})
          </summary>
          <div className="absolute end-0 z-20 mt-1 w-56 rounded-md border border-[var(--color-border)] bg-white p-2 shadow-lg">
            <label className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
              <input type="checkbox" checked={allSelected} onChange={onSelectAllPractitioners} />
              <span className="font-medium">{t("allPractitioners")}</span>
            </label>
            <div className="my-1 border-t border-[var(--color-border)]" />
            {practitioners.map((p) => (
              <label key={p.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selectedPractitionerIds.includes(p.id)}
                  onChange={() => onTogglePractitioner(p.id)}
                />
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.colorHex }} />
                {p.name}
              </label>
            ))}
          </div>
        </details>

        <button
          type="button"
          onClick={onJumpToNow}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          {t("jumpToNow")}
        </button>

        <button
          type="button"
          onClick={onNewAppointment}
          className="rounded-md bg-[var(--color-blue)] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-blue-600"
        >
          + {t("newAppointment")}
        </button>
      </div>
    </div>
  );
}
