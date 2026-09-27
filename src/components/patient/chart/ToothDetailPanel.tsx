"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Practitioner } from "@prisma/client";
import { useRouter } from "@/i18n/navigation";
import { formatLongDate } from "@/lib/time";
import { toothName } from "@/lib/dental/teeth";
import { useToast } from "@/components/ui/Toast";
import { completeChartEntryAction, retractChartEntryAction } from "@/lib/actions/chart-actions";
import { getToothHistoryAction } from "@/lib/actions/query-actions";
import { ChartEntryModal } from "@/components/patient/chart/ChartEntryModal";
import { ToothNoteModal } from "@/components/patient/chart/ToothNoteModal";
import type { getToothHistory } from "@/lib/services/patient-queries";
import type { SURFACE_ORDER } from "@/components/patient/chart/Odontogram";

type ToothHistory = Awaited<ReturnType<typeof getToothHistory>>;

const STATUS_BADGE: Record<string, string> = {
  EXISTING: "bg-blue-50 text-[var(--color-navy)]",
  PLANNED: "bg-[var(--color-status-confirmed-bg)] text-[var(--color-status-confirmed)]",
  COMPLETED: "bg-[var(--color-status-completed-bg)] text-[var(--color-status-completed)]",
};

export function ToothDetailPanel({
  patientId,
  toothNumber,
  selectedSurface,
  practitioners,
  defaultPractitionerId,
  canManage,
  onClose,
}: {
  patientId: string;
  toothNumber: string;
  selectedSurface: (typeof SURFACE_ORDER)[number] | null;
  practitioners: Practitioner[];
  defaultPractitionerId: string | null;
  canManage: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("dental");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();

  const [history, setHistory] = useState<ToothHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);

  function reload() {
    setLoading(true);
    getToothHistoryAction(patientId, toothNumber).then((h) => {
      setHistory(h);
      setLoading(false);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toothNumber]);

  async function handleComplete(chartEntryId: string) {
    const result = await completeChartEntryAction({ chartEntryId });
    if (result.ok) {
      toast.show(tCommon("save"), { tone: "success" });
      reload();
      router.refresh();
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  async function handleRetract(chartEntryId: string) {
    if (!window.confirm(t("retractConfirm"))) return;
    const result = await retractChartEntryAction({ chartEntryId });
    if (result.ok) {
      toast.show(tCommon("save"), { tone: "success" });
      reload();
      router.refresh();
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  const activeEntries = history?.entries.filter((e) => e.active) ?? [];

  const timeline = [
    ...(history?.entries.map((e) => ({ kind: "entry" as const, date: e.recordedDate, item: e })) ?? []),
    ...(history?.notes.map((n) => ({ kind: "note" as const, date: n.createdAt, item: n })) ?? []),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-[var(--color-border)] bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--color-text)]">{t("toothLabel", { tooth: toothNumber })}</h3>
          <p className="text-xs text-gray-500">{toothName(toothNumber)}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={tCommon("close")} className="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEntryModalOpen(true)}
            className="rounded-md bg-[var(--color-blue)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"
          >
            {t("addFindingShort")}
          </button>
          <button
            type="button"
            onClick={() => setNoteModalOpen(true)}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            {t("addNoteShort")}
          </button>
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{t("currentFindings")}</p>
        {loading ? (
          <p className="text-sm text-gray-400">{tCommon("loading")}</p>
        ) : activeEntries.length === 0 ? (
          <p className="text-sm text-gray-400">{t("noFindings")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {activeEntries.map((entry) => (
              <li key={entry.id} className="rounded-md border border-[var(--color-border)] p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--color-text)]">
                    {t(`items.${entry.itemCode}`)}
                    {entry.surface ? ` · ${t(`surfaces.${entry.surface}`)}` : ` · ${t("wholeTooth")}`}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[entry.status]}`}>
                    {t(`status.${entry.status}`)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-400">
                  {formatLongDate(entry.recordedDate, locale)} · {entry.practitioner?.name ?? "—"}
                </p>
                {entry.note && <p className="mt-1 text-xs text-gray-600">{entry.note}</p>}
                {canManage && (
                  <div className="mt-1.5 flex gap-2 text-xs font-medium">
                    {entry.status === "PLANNED" && (
                      <button type="button" onClick={() => handleComplete(entry.id)} className="text-[var(--color-blue)] hover:underline">
                        {t("markCompleted")}
                      </button>
                    )}
                    <button type="button" onClick={() => handleRetract(entry.id)} className="text-gray-400 hover:text-[var(--color-status-fta)]">
                      {t("retract")}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{t("toothHistory")}</p>
        {loading ? (
          <p className="text-sm text-gray-400">{tCommon("loading")}</p>
        ) : timeline.length === 0 ? (
          <p className="text-sm text-gray-400">{t("noHistory")}</p>
        ) : (
          <ul className="flex max-h-64 flex-col gap-2 overflow-auto">
            {timeline.map((row) =>
              row.kind === "entry" ? (
                <li key={`entry-${row.item.id}`} className="text-xs text-gray-600">
                  <span className="font-medium text-[var(--color-text)]">{formatLongDate(row.date, locale)}</span> —{" "}
                  {t(`items.${row.item.itemCode}`)} ({t(`status.${row.item.status}`)})
                  {!row.item.active && <span className="ms-1 italic text-gray-400">{t("retracted")}</span>}
                </li>
              ) : (
                <li key={`note-${row.item.id}`} className="text-xs text-gray-600">
                  <span className="font-medium text-[var(--color-text)]">{formatLongDate(row.date, locale)}</span> — {t("clinicalNote")}:{" "}
                  {row.item.content.slice(0, 60)}
                  {row.item.content.length > 60 ? "…" : ""}
                </li>
              )
            )}
          </ul>
        )}
      </div>

      {entryModalOpen && (
        <ChartEntryModal
          patientId={patientId}
          toothNumber={toothNumber}
          initialSurface={selectedSurface}
          practitioners={practitioners}
          defaultPractitionerId={defaultPractitionerId}
          onClose={() => setEntryModalOpen(false)}
          onCreated={() => {
            setEntryModalOpen(false);
            reload();
            router.refresh();
          }}
        />
      )}

      {noteModalOpen && (
        <ToothNoteModal
          patientId={patientId}
          toothNumber={toothNumber}
          practitioners={practitioners}
          defaultPractitionerId={defaultPractitionerId}
          onClose={() => setNoteModalOpen(false)}
          onCreated={() => {
            setNoteModalOpen(false);
            reload();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
