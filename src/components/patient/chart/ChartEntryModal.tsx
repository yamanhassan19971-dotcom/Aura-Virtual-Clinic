"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Practitioner } from "@prisma/client";
import { CHART_ITEM_CATALOG, CHART_ITEM_CODES, type ChartItemCode } from "@/lib/dental/chart-item-catalog";
import { hasOcclusalSurface } from "@/lib/dental/teeth";
import { SURFACE_ORDER } from "@/components/patient/chart/Odontogram";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { toDateParam } from "@/lib/time";
import { createChartEntryAction } from "@/lib/actions/chart-actions";
import type { ChartEntryWithRelations } from "@/lib/services/chart-service";

export function ChartEntryModal({
  patientId,
  toothNumber,
  initialSurface,
  practitioners,
  defaultPractitionerId,
  onClose,
  onCreated,
}: {
  patientId: string;
  toothNumber: string;
  initialSurface: (typeof SURFACE_ORDER)[number] | null;
  practitioners: Practitioner[];
  defaultPractitionerId: string | null;
  onClose: () => void;
  onCreated: (entry: ChartEntryWithRelations) => void;
}) {
  const t = useTranslations("dental");
  const tCommon = useTranslations("common");
  const toast = useToast();

  const [itemCode, setItemCode] = useState<ChartItemCode>("FILLING");
  const [wholeTooth, setWholeTooth] = useState(initialSurface === null);
  const [surface, setSurface] = useState<(typeof SURFACE_ORDER)[number] | null>(initialSurface ?? "OCCLUSAL");
  const [status, setStatus] = useState<"EXISTING" | "PLANNED" | "COMPLETED">("EXISTING");
  const [recordedDate, setRecordedDate] = useState(toDateParam(new Date()));
  const [practitionerId, setPractitionerId] = useState(defaultPractitionerId ?? practitioners[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const definition = CHART_ITEM_CATALOG[itemCode];
  const isMissing = itemCode === "MISSING";
  const canPickSurface = definition.surfaceApplicable && !isMissing;
  const posterior = hasOcclusalSurface(toothNumber);
  const availableSurfaces = SURFACE_ORDER.filter((s) => posterior || s !== "OCCLUSAL");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await createChartEntryAction({
      patientId,
      toothNumber,
      surface: canPickSurface && !wholeTooth ? surface : null,
      itemCode,
      status,
      recordedDate: new Date(`${recordedDate}T00:00:00`),
      practitionerId: practitionerId || null,
      note: note || null,
    });
    setSubmitting(false);
    if (result.ok) {
      toast.show(tCommon("save"), { tone: "success" });
      const created = result.data as ChartEntryWithRelations;
      const practitioner = practitioners.find((p) => p.id === practitionerId);
      onCreated({
        ...created,
        practitioner: practitioner ? { name: practitioner.name } : null,
        createdBy: null,
        resolvedBy: null,
        appointment: null,
      });
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  return (
    <Modal title={t("addFinding", { tooth: toothNumber })} onClose={onClose} width="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("itemType")}
          <select
            value={itemCode}
            onChange={(e) => {
              const next = e.target.value as ChartItemCode;
              setItemCode(next);
              if (CHART_ITEM_CATALOG[next].wholeToothDefault) setWholeTooth(true);
            }}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          >
            {CHART_ITEM_CODES.map((code) => (
              <option key={code} value={code}>
                {t(`items.${code}`)}
              </option>
            ))}
          </select>
        </label>

        {canPickSurface && (
          <div className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {t("scope")}
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-1.5 text-sm font-normal text-gray-600">
                <input type="radio" checked={wholeTooth} onChange={() => setWholeTooth(true)} />
                {t("wholeTooth")}
              </label>
              <label className="flex items-center gap-1.5 text-sm font-normal text-gray-600">
                <input type="radio" checked={!wholeTooth} onChange={() => setWholeTooth(false)} />
                {t("specificSurface")}
              </label>
            </div>
            {!wholeTooth && (
              <select
                value={surface ?? ""}
                onChange={(e) => setSurface(e.target.value as (typeof SURFACE_ORDER)[number])}
                className="mt-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
              >
                {availableSurfaces.map((s) => (
                  <option key={s} value={s}>
                    {t(`surfaces.${s}`)}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {!isMissing && (
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {t("status.label")}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <option value="EXISTING">{t("status.EXISTING")}</option>
              <option value="PLANNED">{t("status.PLANNED")}</option>
              <option value="COMPLETED">{t("status.COMPLETED")}</option>
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("recordedDate")}
          <input
            type="date"
            value={recordedDate}
            onChange={(e) => setRecordedDate(e.target.value)}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("practitioner")}
          <select
            value={practitionerId}
            onChange={(e) => setPractitionerId(e.target.value)}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {practitioners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("note")}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            {tCommon("cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-[var(--color-blue)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            {tCommon("save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
