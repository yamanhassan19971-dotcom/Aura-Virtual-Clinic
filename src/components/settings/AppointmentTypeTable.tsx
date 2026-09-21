"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AppointmentType } from "@prisma/client";
import { createAppointmentTypeAction, updateAppointmentTypeAction } from "@/lib/actions/settings-actions";
import { useToast } from "@/components/ui/Toast";

export function AppointmentTypeTable({ appointmentTypes: initial }: { appointmentTypes: AppointmentType[] }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [types, setTypes] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [color, setColor] = useState("#3B82F6");
  const [submitting, setSubmitting] = useState(false);

  async function toggleActive(type: AppointmentType) {
    const result = await updateAppointmentTypeAction({ appointmentTypeId: type.id, active: !type.active });
    if (result.ok) {
      setTypes((prev) => prev.map((x) => (x.id === type.id ? result.data : x)));
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await createAppointmentTypeAction({ name, defaultDurationMin: duration, colorHex: color });
    setSubmitting(false);
    if (result.ok) {
      setTypes((prev) => [...prev, result.data]);
      setAdding(false);
      setName("");
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  return (
    <div className="max-w-3xl rounded-lg border border-[var(--color-border)] bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-xs font-semibold uppercase tracking-wide text-gray-400">
            <th className="px-4 py-3 text-start">{t("name")}</th>
            <th className="px-4 py-3 text-start">{t("defaultDuration")}</th>
            <th className="px-4 py-3 text-start">{t("active")}</th>
          </tr>
        </thead>
        <tbody>
          {types.map((type) => (
            <tr key={type.id} className="border-b border-[var(--color-border)] last:border-0">
              <td className="px-4 py-2.5">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: type.colorHex }} />
                  {type.name}
                </span>
              </td>
              <td className="px-4 py-2.5 text-gray-500">
                {type.defaultDurationMin} {tCommon("min")}
              </td>
              <td className="px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleActive(type)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    type.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {type.active ? t("active") : t("inactive")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="p-4">
        {adding ? (
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
              {t("name")}
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
              {t("defaultDuration")}
              <input
                type="number"
                min={5}
                max={480}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-24 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
              {t("colour")}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-12 rounded border border-[var(--color-border)]"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-[var(--color-blue)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {t("save")}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-gray-600"
            >
              ×
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-md border border-dashed border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-gray-500 hover:border-[var(--color-blue)] hover:text-[var(--color-blue)]"
          >
            + {t("addType")}
          </button>
        )}
      </div>
    </div>
  );
}
