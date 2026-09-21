"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { WorkingHours } from "@prisma/client";
import { setWorkingHoursAction } from "@/lib/actions/settings-actions";
import { useToast } from "@/components/ui/Toast";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function timeStrToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function WorkingHoursTable({ workingHours: initial }: { workingHours: WorkingHours[] }) {
  const t = useTranslations("settings");
  const tWeekday = useTranslations("weekday");
  const toast = useToast();
  const [rows, setRows] = useState<Map<number, WorkingHours | null>>(
    new Map(WEEKDAYS.map((d) => [d, initial.find((w) => w.weekday === d) ?? null]))
  );
  const [savingDay, setSavingDay] = useState<number | null>(null);

  async function handleChange(weekday: number, field: "startMinute" | "endMinute" | "closed", value: string | boolean) {
    const current = rows.get(weekday);
    const closed = field === "closed" ? (value as boolean) : current === null;
    const startMinute = field === "startMinute" ? timeStrToMinutes(value as string) : (current?.startMinute ?? 8 * 60);
    const endMinute = field === "endMinute" ? timeStrToMinutes(value as string) : (current?.endMinute ?? 18 * 60);

    setSavingDay(weekday);
    const result = await setWorkingHoursAction({ weekday, startMinute, endMinute, closed });
    setSavingDay(null);
    if (result.ok) {
      setRows((prev) => new Map(prev).set(weekday, result.data));
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  return (
    <div className="max-w-2xl rounded-lg border border-[var(--color-border)] bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-xs font-semibold uppercase tracking-wide text-gray-400">
            <th className="px-4 py-3 text-start">{t("weekday")}</th>
            <th className="px-4 py-3 text-start">{t("startTime")}</th>
            <th className="px-4 py-3 text-start">{t("endTime")}</th>
            <th className="px-4 py-3 text-start" />
          </tr>
        </thead>
        <tbody>
          {WEEKDAYS.map((day) => {
            const row = rows.get(day) ?? null;
            const closed = row === null;
            return (
              <tr key={day} className="border-b border-[var(--color-border)] last:border-0">
                <td className="px-4 py-2.5 font-medium text-[var(--color-text)]">{tWeekday(String(day))}</td>
                <td className="px-4 py-2.5">
                  <input
                    type="time"
                    disabled={closed || savingDay === day}
                    value={minutesToTimeStr(row?.startMinute ?? 8 * 60)}
                    onChange={(e) => handleChange(day, "startMinute", e.target.value)}
                    className="rounded-md border border-[var(--color-border)] px-2 py-1 text-sm disabled:opacity-40"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <input
                    type="time"
                    disabled={closed || savingDay === day}
                    value={minutesToTimeStr(row?.endMinute ?? 18 * 60)}
                    onChange={(e) => handleChange(day, "endMinute", e.target.value)}
                    className="rounded-md border border-[var(--color-border)] px-2 py-1 text-sm disabled:opacity-40"
                  />
                </td>
                <td className="px-4 py-2.5">
                  <label className="flex items-center gap-1.5 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={closed}
                      disabled={savingDay === day}
                      onChange={(e) => handleChange(day, "closed", e.target.checked)}
                    />
                    Closed
                  </label>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
