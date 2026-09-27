"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Practitioner } from "@prisma/client";
import { formatLongDate } from "@/lib/time";
import { CHART_ENTRY_STATUSES, CHART_ITEM_CODES } from "@/lib/dental/chart-item-catalog";
import type { ChartEntryWithRelations } from "@/lib/services/chart-service";

const STATUS_BADGE: Record<string, string> = {
  EXISTING: "bg-blue-50 text-[var(--color-navy)]",
  PLANNED: "bg-[var(--color-status-confirmed-bg)] text-[var(--color-status-confirmed)]",
  COMPLETED: "bg-[var(--color-status-completed-bg)] text-[var(--color-status-completed)]",
};

export function ChartHistoryList({
  entries,
  practitioners,
  onSelectTooth,
}: {
  entries: ChartEntryWithRelations[];
  practitioners: Practitioner[];
  onSelectTooth: (toothNumber: string) => void;
}) {
  const t = useTranslations("dental");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const [toothFilter, setToothFilter] = useState("");
  const [practitionerFilter, setPractitionerFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (toothFilter && e.toothNumber !== toothFilter) return false;
        if (practitionerFilter && e.practitionerId !== practitionerFilter) return false;
        if (itemFilter && e.itemCode !== itemFilter) return false;
        if (statusFilter && e.status !== statusFilter) return false;
        return true;
      }),
    [entries, toothFilter, practitionerFilter, itemFilter, statusFilter]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={toothFilter}
          onChange={(e) => setToothFilter(e.target.value)}
          placeholder={t("filterByTooth")}
          className="w-28 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm"
        />
        <select
          value={practitionerFilter}
          onChange={(e) => setPractitionerFilter(e.target.value)}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm"
        >
          <option value="">{t("allPractitioners")}</option>
          {practitioners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={itemFilter}
          onChange={(e) => setItemFilter(e.target.value)}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm"
        >
          <option value="">{t("allItemTypes")}</option>
          {CHART_ITEM_CODES.map((code) => (
            <option key={code} value={code}>
              {t(`items.${code}`)}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm"
        >
          <option value="">{t("allStatuses")}</option>
          {CHART_ENTRY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400">{tCommon("noResults")}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-start text-xs uppercase tracking-wide text-gray-400">
              <th className="py-1.5 text-start font-medium">{t("date")}</th>
              <th className="py-1.5 text-start font-medium">{t("tooth")}</th>
              <th className="py-1.5 text-start font-medium">{t("finding")}</th>
              <th className="py-1.5 text-start font-medium">{t("status.label")}</th>
              <th className="py-1.5 text-start font-medium">{tCommon("practitioner")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.id} className={`border-b border-[var(--color-border)] ${!entry.active ? "opacity-50" : ""}`}>
                <td className="py-1.5">{formatLongDate(entry.recordedDate, locale)}</td>
                <td className="py-1.5">
                  <button type="button" onClick={() => onSelectTooth(entry.toothNumber)} className="font-medium text-[var(--color-blue)] hover:underline">
                    {entry.toothNumber}
                  </button>
                </td>
                <td className="py-1.5">
                  {t(`items.${entry.itemCode}`)}
                  {entry.surface ? ` · ${t(`surfaces.${entry.surface}`)}` : ` · ${t("wholeTooth")}`}
                </td>
                <td className="py-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[entry.status]}`}>{t(`status.${entry.status}`)}</span>
                  {!entry.active && <span className="ms-1 text-xs italic text-gray-400">{t("retracted")}</span>}
                </td>
                <td className="py-1.5 text-gray-500">{entry.practitioner?.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
