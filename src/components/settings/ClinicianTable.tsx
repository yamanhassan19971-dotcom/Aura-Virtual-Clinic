"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Practitioner, Room } from "@prisma/client";
import { createPractitionerAction, updatePractitionerAction } from "@/lib/actions/settings-actions";
import { useToast } from "@/components/ui/Toast";

export function ClinicianTable({ practitioners: initial, rooms }: { practitioners: Practitioner[]; rooms: Room[] }) {
  const t = useTranslations("settings");
  const toast = useToast();
  const [practitioners, setPractitioners] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("Dentist");
  const [color, setColor] = useState("#3B82F6");
  const [defaultRoomId, setDefaultRoomId] = useState(rooms[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function toggleActive(p: Practitioner) {
    const result = await updatePractitionerAction({ practitionerId: p.id, active: !p.active });
    if (result.ok) {
      setPractitioners((prev) => prev.map((x) => (x.id === p.id ? result.data : x)));
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await createPractitionerAction({ name, title, colorHex: color, defaultRoomId });
    setSubmitting(false);
    if (result.ok) {
      setPractitioners((prev) => [...prev, result.data]);
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
          <tr className="border-b border-[var(--color-border)] text-start text-xs font-semibold uppercase tracking-wide text-gray-400">
            <th className="px-4 py-3 text-start">{t("name")}</th>
            <th className="px-4 py-3 text-start">{t("title_")}</th>
            <th className="px-4 py-3 text-start">{t("defaultRoom")}</th>
            <th className="px-4 py-3 text-start">{t("active")}</th>
          </tr>
        </thead>
        <tbody>
          {practitioners.map((p) => (
            <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0">
              <td className="px-4 py-2.5">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.colorHex }} />
                  {p.name}
                </span>
              </td>
              <td className="px-4 py-2.5 text-gray-500">{p.title}</td>
              <td className="px-4 py-2.5 text-gray-500">
                {rooms.find((r) => r.id === p.defaultRoomId)?.name ?? "—"}
              </td>
              <td className="px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleActive(p)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    p.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {p.active ? t("active") : t("inactive")}
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
              {t("title_")}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
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
            <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
              {t("defaultRoom")}
              <select
                value={defaultRoomId}
                onChange={(e) => setDefaultRoomId(e.target.value)}
                className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
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
            + {t("addClinician")}
          </button>
        )}
      </div>
    </div>
  );
}
