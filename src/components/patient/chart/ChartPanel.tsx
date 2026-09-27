"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { Practitioner } from "@prisma/client";
import type { ToothSurfaceCode } from "@/lib/dental/chart-item-catalog";
import { summarizeChartByTooth } from "@/lib/dental/chart-summary";
import { Odontogram, type DentitionMode } from "@/components/patient/chart/Odontogram";
import { ToothDetailPanel } from "@/components/patient/chart/ToothDetailPanel";
import { ChartHistoryList } from "@/components/patient/chart/ChartHistoryList";
import { BpeSection } from "@/components/patient/chart/BpeSection";
import type { ChartEntryWithRelations } from "@/lib/services/chart-service";
import type { BpeExamWithRelations } from "@/lib/services/bpe-service";

type Section = "odontogram" | "history" | "bpe";

export function ChartPanel({
  patientId,
  entries,
  bpeExams,
  practitioners,
  defaultPractitionerId,
  canManageChart,
  canManageBpe,
}: {
  patientId: string;
  entries: ChartEntryWithRelations[];
  bpeExams: BpeExamWithRelations[];
  practitioners: Practitioner[];
  defaultPractitionerId: string | null;
  canManageChart: boolean;
  canManageBpe: boolean;
}) {
  const t = useTranslations("dental");
  const [mode, setMode] = useState<DentitionMode>("PERMANENT");
  const [section, setSection] = useState<Section>("odontogram");
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
  const [selectedSurface, setSelectedSurface] = useState<ToothSurfaceCode | null>(null);

  const toothSummaries = useMemo(() => summarizeChartByTooth(entries), [entries]);

  function handleSelect(fdi: string, surface: ToothSurfaceCode | null) {
    setSelectedTooth(fdi);
    setSelectedSurface(surface);
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-md border border-[var(--color-border)] bg-white p-0.5 text-sm">
          {(["odontogram", "history", "bpe"] as Section[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSection(s)}
              className={`rounded px-3 py-1.5 font-medium ${
                section === s ? "bg-[var(--color-navy)] text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {t(`sections.${s}`)}
            </button>
          ))}
        </div>

        {section === "odontogram" && (
          <div className="flex gap-1 rounded-md border border-[var(--color-border)] bg-white p-0.5 text-sm">
            {(["PERMANENT", "DECIDUOUS", "MIXED"] as DentitionMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded px-3 py-1.5 font-medium ${
                  mode === m ? "bg-[var(--color-blue)] text-white" : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {t(`dentitionMode.${m}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {section === "odontogram" && (
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <Odontogram mode={mode} toothSummaries={toothSummaries} selectedTooth={selectedTooth} selectedSurface={selectedSurface} onSelect={handleSelect} />
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm border-2 border-[var(--color-navy)] bg-blue-50" /> {t("legend.existing")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm border-2 border-[var(--color-status-completed)] bg-[var(--color-status-completed-bg)]" />{" "}
                {t("legend.completed")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-[var(--color-status-confirmed)] text-[7px] font-bold text-white">
                  P
                </span>{" "}
                {t("legend.planned")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="relative inline-block h-3 w-3 rounded-sm border-2 border-dashed border-gray-300 bg-gray-50">
                  <span className="absolute h-px w-[130%] rotate-45 bg-[var(--color-status-fta)]" />
                </span>{" "}
                {t("legend.missing")}
              </span>
            </div>
          </div>

          {selectedTooth && (
            <ToothDetailPanel
              patientId={patientId}
              toothNumber={selectedTooth}
              selectedSurface={selectedSurface}
              practitioners={practitioners}
              defaultPractitionerId={defaultPractitionerId}
              canManage={canManageChart}
              onClose={() => setSelectedTooth(null)}
            />
          )}
        </div>
      )}

      {section === "history" && (
        <ChartHistoryList
          entries={entries}
          practitioners={practitioners}
          onSelectTooth={(tooth) => {
            setSection("odontogram");
            setSelectedTooth(tooth);
            setSelectedSurface(null);
          }}
        />
      )}

      {section === "bpe" && (
        <BpeSection
          patientId={patientId}
          exams={bpeExams}
          practitioners={practitioners}
          defaultPractitionerId={defaultPractitionerId}
          canManage={canManageBpe}
        />
      )}
    </div>
  );
}
