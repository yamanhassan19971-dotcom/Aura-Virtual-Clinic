"use client";

import { useTranslations } from "next-intl";
import type { ToothSurfaceCode } from "@/lib/dental/chart-item-catalog";
import { DECIDUOUS_TEETH, PERMANENT_TEETH, hasOcclusalSurface, lowerArchOrder, upperArchOrder, type ToothInfo } from "@/lib/dental/teeth";
import type { ToothSummary } from "@/lib/dental/chart-summary";

export type DentitionMode = "PERMANENT" | "DECIDUOUS" | "MIXED";

const SURFACE_ORDER: ToothSurfaceCode[] = ["BUCCAL", "MESIAL", "OCCLUSAL", "DISTAL", "LINGUAL"];

function surfaceFillClass(status: "EXISTING" | "PLANNED" | "COMPLETED" | undefined) {
  if (status === "COMPLETED") return "bg-[var(--color-status-completed)]";
  if (status === "EXISTING") return "bg-[var(--color-navy)]";
  if (status === "PLANNED") return "bg-[var(--color-status-confirmed)]";
  return "bg-transparent";
}

function ToothBox({
  tooth,
  summary,
  selected,
  selectedSurface,
  onSelect,
}: {
  tooth: ToothInfo;
  summary: ToothSummary | undefined;
  selected: boolean;
  selectedSurface: ToothSurfaceCode | null;
  onSelect: (fdi: string, surface: ToothSurfaceCode | null) => void;
}) {
  const t = useTranslations("dental");
  const posterior = hasOcclusalSurface(tooth.fdi);
  const isMissing = summary?.isMissing ?? false;
  const wholeToothStatus = summary?.wholeTooth?.status;

  const wholeToothItemCode = summary?.wholeTooth?.itemCode;
  const title = wholeToothItemCode ? `${tooth.fdi} — ${t(`items.${wholeToothItemCode}`)}` : tooth.fdi;

  const wholeToothClass = isMissing
    ? "bg-gray-50 border-dashed border-gray-300"
    : wholeToothStatus === "COMPLETED"
      ? "bg-[var(--color-status-completed-bg)] border-[var(--color-status-completed)]"
      : wholeToothStatus === "EXISTING"
        ? "bg-blue-50 border-[var(--color-navy)]"
        : "bg-white border-[var(--color-border)]";

  return (
    <div className="flex flex-col items-center gap-0.5">
      {/* A whole-tooth click target and the per-surface click targets below
          are siblings, not nested <button>s — HTML forbids a <button>
          inside another <button> (and React would throw a hydration error
          on it), so the outer box is a plain, non-interactive <div>. */}
      <div
        title={title}
        className={`relative flex h-12 w-12 flex-col items-center justify-center rounded-md border-2 transition-colors ${wholeToothClass} ${
          selected ? "ring-2 ring-[var(--color-blue)] ring-offset-1" : ""
        }`}
      >
        <button
          type="button"
          data-testid="tooth-button"
          data-tooth={tooth.fdi}
          onClick={() => onSelect(tooth.fdi, null)}
          aria-pressed={selected && selectedSurface === null}
          className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-[var(--color-text)] hover:bg-black/5"
        >
          {tooth.fdi}
        </button>

        {!isMissing && (
          <div className="mt-0.5 grid grid-cols-3 grid-rows-3 gap-px" style={{ width: 22, height: 22 }}>
            {(["BUCCAL", null, null, "MESIAL", posterior ? "OCCLUSAL" : null, "DISTAL", null, "LINGUAL", null] as (ToothSurfaceCode | null)[]).map(
              (surface, i) =>
                surface ? (
                  <button
                    key={surface}
                    type="button"
                    data-testid="tooth-surface-button"
                    data-tooth={tooth.fdi}
                    data-surface={surface}
                    aria-label={t(`surfaces.${surface}`)}
                    aria-pressed={selected && selectedSurface === surface}
                    onClick={() => onSelect(tooth.fdi, surface)}
                    className={`${surfaceFillClass(summary?.surfaces[surface]?.status)} ${
                      selected && selectedSurface === surface ? "ring-1 ring-[var(--color-blue)]" : "border border-gray-200"
                    }`}
                  />
                ) : (
                  <span key={i} />
                )
            )}
          </div>
        )}

        {isMissing && <span className="absolute h-px w-[130%] rotate-45 bg-[var(--color-status-fta)]" aria-hidden />}
        {!isMissing && summary?.hasPlannedWholeTooth && (
          <span
            className="absolute -end-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--color-status-confirmed)] text-[8px] font-bold text-white"
            title={t("plannedIndicator")}
          >
            P
          </span>
        )}
      </div>
    </div>
  );
}

function ArchRow({
  teeth,
  toothSummaries,
  selectedTooth,
  selectedSurface,
  onSelect,
  label,
}: {
  teeth: ToothInfo[];
  toothSummaries: Map<string, ToothSummary>;
  selectedTooth: string | null;
  selectedSurface: ToothSurfaceCode | null;
  onSelect: (fdi: string, surface: ToothSurfaceCode | null) => void;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {label && <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>}
      <div className="flex flex-wrap justify-center gap-1.5">
        {teeth.map((tooth) => (
          <ToothBox
            key={tooth.fdi}
            tooth={tooth}
            summary={toothSummaries.get(tooth.fdi)}
            selected={selectedTooth === tooth.fdi}
            selectedSurface={selectedSurface}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

export function Odontogram({
  mode,
  toothSummaries,
  selectedTooth,
  selectedSurface,
  onSelect,
}: {
  mode: DentitionMode;
  toothSummaries: Map<string, ToothSummary>;
  selectedTooth: string | null;
  selectedSurface: ToothSurfaceCode | null;
  onSelect: (fdi: string, surface: ToothSurfaceCode | null) => void;
}) {
  const t = useTranslations("dental");
  const permanentUpper = upperArchOrder(PERMANENT_TEETH);
  const permanentLower = lowerArchOrder(PERMANENT_TEETH);
  const deciduousUpper = upperArchOrder(DECIDUOUS_TEETH);
  const deciduousLower = lowerArchOrder(DECIDUOUS_TEETH);

  const rowProps = { toothSummaries, selectedTooth, selectedSurface, onSelect };

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-[var(--color-border)] bg-white p-6">
      <p className="text-xs text-gray-400">{t("upperArch")}</p>
      {(mode === "PERMANENT" || mode === "MIXED") && <ArchRow teeth={permanentUpper} {...rowProps} />}
      {(mode === "DECIDUOUS" || mode === "MIXED") && (
        <ArchRow teeth={deciduousUpper} label={mode === "MIXED" ? t("deciduous") : undefined} {...rowProps} />
      )}
      <div className="h-px w-full max-w-md bg-[var(--color-border)]" />
      {(mode === "DECIDUOUS" || mode === "MIXED") && (
        <ArchRow teeth={deciduousLower} label={mode === "MIXED" ? t("deciduous") : undefined} {...rowProps} />
      )}
      {(mode === "PERMANENT" || mode === "MIXED") && <ArchRow teeth={permanentLower} {...rowProps} />}
      <p className="text-xs text-gray-400">{t("lowerArch")}</p>
    </div>
  );
}

export { SURFACE_ORDER };
