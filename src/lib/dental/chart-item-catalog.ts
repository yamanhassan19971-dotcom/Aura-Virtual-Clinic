// Code-defined, easily extended list of chart findings/treatments — same
// configurability approach as lib/medical/question-catalog.ts and
// lib/patients/flag-catalog.ts. `itemCode` on ChartEntry is one of these
// keys rather than a hard-coded switch statement scattered through React
// components, so Phase 4 can expand the vocabulary without a migration.
// Labels live in i18n (dental.chartItems.<CODE>), not here.
export const CHART_ITEM_CODES = [
  "FILLING",
  "CROWN",
  "BRIDGE",
  "IMPLANT",
  "ROOT_CANAL",
  "MISSING",
  "DENTURE",
  "VENEER",
  "OTHER",
] as const;

export type ChartItemCode = (typeof CHART_ITEM_CODES)[number];

export type ChartItemDefinition = {
  code: ChartItemCode;
  /** Can this finding/treatment be charted on an individual surface, not just the whole tooth? */
  surfaceApplicable: boolean;
  /** UI default when charting this item — most restorations/conditions below default to whole-tooth. */
  wholeToothDefault: boolean;
  /** Drives the odontogram's "missing" visual (greyed tooth + cross) regardless of surface. */
  isMissingIndicator?: boolean;
};

export const CHART_ITEM_CATALOG: Record<ChartItemCode, ChartItemDefinition> = {
  FILLING: { code: "FILLING", surfaceApplicable: true, wholeToothDefault: false },
  CROWN: { code: "CROWN", surfaceApplicable: false, wholeToothDefault: true },
  BRIDGE: { code: "BRIDGE", surfaceApplicable: false, wholeToothDefault: true },
  IMPLANT: { code: "IMPLANT", surfaceApplicable: false, wholeToothDefault: true },
  ROOT_CANAL: { code: "ROOT_CANAL", surfaceApplicable: false, wholeToothDefault: true },
  MISSING: { code: "MISSING", surfaceApplicable: false, wholeToothDefault: true, isMissingIndicator: true },
  DENTURE: { code: "DENTURE", surfaceApplicable: false, wholeToothDefault: true },
  VENEER: { code: "VENEER", surfaceApplicable: true, wholeToothDefault: false },
  OTHER: { code: "OTHER", surfaceApplicable: true, wholeToothDefault: true },
};

export function isValidChartItemCode(code: string): code is ChartItemCode {
  return Object.prototype.hasOwnProperty.call(CHART_ITEM_CATALOG, code);
}

export const TOOTH_SURFACES = ["MESIAL", "DISTAL", "OCCLUSAL", "BUCCAL", "LINGUAL"] as const;
export type ToothSurfaceCode = (typeof TOOTH_SURFACES)[number];

export const CHART_ENTRY_STATUSES = ["EXISTING", "PLANNED", "COMPLETED"] as const;

export const BPE_SEXTANTS = [
  "UPPER_RIGHT",
  "UPPER_ANTERIOR",
  "UPPER_LEFT",
  "LOWER_RIGHT",
  "LOWER_ANTERIOR",
  "LOWER_LEFT",
] as const;
export type BpeSextantCode = (typeof BPE_SEXTANTS)[number];

export const BPE_CODES = ["0", "1", "2", "3", "4", "*"] as const;

export const CLINICAL_IMAGE_CATEGORIES = ["INTRAORAL_PHOTO", "EXTRAORAL_PHOTO", "RADIOGRAPH", "OTHER"] as const;
