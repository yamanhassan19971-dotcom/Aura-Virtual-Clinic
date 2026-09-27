import { CHART_ITEM_CATALOG, type ChartItemCode, type ToothSurfaceCode } from "@/lib/dental/chart-item-catalog";

// Deliberately structural (not imported from the Prisma-backed service
// types) so this pure summarizing logic can be safely imported from client
// components without pulling `@/lib/db` into the browser bundle.
export type ChartEntryLike = {
  id: string;
  toothNumber: string;
  surface: ToothSurfaceCode | null;
  itemCode: string;
  status: "EXISTING" | "PLANNED" | "COMPLETED";
  active: boolean;
  recordedDate: Date | string;
};

export type ToothSummary = {
  toothNumber: string;
  isMissing: boolean;
  /** "Present" state to fill the whole tooth with — the most recent whole-tooth EXISTING/COMPLETED entry, if any. */
  wholeTooth: { status: "EXISTING" | "COMPLETED"; itemCode: string } | null;
  hasPlannedWholeTooth: boolean;
  surfaces: Partial<Record<ToothSurfaceCode, { status: "EXISTING" | "PLANNED" | "COMPLETED"; itemCode: string }>>;
  activeEntryCount: number;
};

function sortByRecordedDateDesc(a: ChartEntryLike, b: ChartEntryLike) {
  return new Date(b.recordedDate).getTime() - new Date(a.recordedDate).getTime();
}

/** Builds a per-tooth visual summary from a patient's (already-fetched) chart entries. Ignores retracted (active=false) entries entirely. */
export function summarizeChartByTooth(entries: ChartEntryLike[]): Map<string, ToothSummary> {
  const byTooth = new Map<string, ChartEntryLike[]>();
  for (const entry of entries) {
    if (!entry.active) continue;
    const list = byTooth.get(entry.toothNumber) ?? [];
    list.push(entry);
    byTooth.set(entry.toothNumber, list);
  }

  const summaries = new Map<string, ToothSummary>();
  for (const [toothNumber, toothEntries] of byTooth) {
    const isMissing = toothEntries.some(
      (e) => (CHART_ITEM_CATALOG[e.itemCode as ChartItemCode]?.isMissingIndicator ?? false) && e.status !== "PLANNED"
    );

    const wholeToothPresent = toothEntries
      .filter((e) => !e.surface && (e.status === "EXISTING" || e.status === "COMPLETED") && !isMissingCode(e.itemCode))
      .sort(sortByRecordedDateDesc)[0];
    const hasPlannedWholeTooth = toothEntries.some((e) => !e.surface && e.status === "PLANNED");

    const surfaces: ToothSummary["surfaces"] = {};
    for (const surface of ["MESIAL", "DISTAL", "OCCLUSAL", "BUCCAL", "LINGUAL"] as ToothSurfaceCode[]) {
      const forSurface = toothEntries.filter((e) => e.surface === surface).sort(sortByRecordedDateDesc);
      if (forSurface.length === 0) continue;
      // Prefer showing a PLANNED or EXISTING/COMPLETED finding, most recent first.
      const chosen =
        forSurface.find((e) => e.status === "COMPLETED") ??
        forSurface.find((e) => e.status === "EXISTING") ??
        forSurface[0];
      surfaces[surface] = { status: chosen.status, itemCode: chosen.itemCode };
    }

    summaries.set(toothNumber, {
      toothNumber,
      isMissing,
      wholeTooth: wholeToothPresent ? { status: wholeToothPresent.status as "EXISTING" | "COMPLETED", itemCode: wholeToothPresent.itemCode } : null,
      hasPlannedWholeTooth,
      surfaces,
      activeEntryCount: toothEntries.length,
    });
  }
  return summaries;
}

function isMissingCode(itemCode: string): boolean {
  return CHART_ITEM_CATALOG[itemCode as ChartItemCode]?.isMissingIndicator ?? false;
}
