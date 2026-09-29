// FDI (ISO 3950) tooth notation reference data. Teeth are a fixed,
// non-patient-specific domain — deliberately not a database table (see the
// ChartEntry model comment in schema.prisma) — so this module is the single
// source of truth for which tooth numbers are valid and what they mean.
// Keeping all FDI-specific logic behind these functions (rather than
// scattering "11-48" range checks through components) is what would let a
// future phase add another numbering system (Universal/Palmer) alongside
// this one without touching ChartEntry or its callers.

export type Arch = "UPPER" | "LOWER";
export type Side = "LEFT" | "RIGHT";
export type DentitionType = "PERMANENT" | "DECIDUOUS";

export type ToothInfo = {
  fdi: string;
  dentitionType: DentitionType;
  arch: Arch;
  side: Side;
  quadrant: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  positionInQuadrant: number;
};

// Translation keys (dental.toothNames.<KEY> in the i18n catalog) — never
// display these directly, the anatomical name must go through the app's
// translation system like every other user-facing string.
const PERMANENT_NAME_KEYS = [
  "CENTRAL_INCISOR",
  "LATERAL_INCISOR",
  "CANINE",
  "FIRST_PREMOLAR",
  "SECOND_PREMOLAR",
  "FIRST_MOLAR",
  "SECOND_MOLAR",
  "THIRD_MOLAR",
] as const;

const DECIDUOUS_NAME_KEYS = ["CENTRAL_INCISOR", "LATERAL_INCISOR", "CANINE", "FIRST_MOLAR", "SECOND_MOLAR"] as const;

export type ToothNameKey = (typeof PERMANENT_NAME_KEYS)[number];

// Quadrant 1 = upper right, 2 = upper left, 3 = lower left, 4 = lower right
// (permanent); 5-8 mirror the same layout for deciduous teeth.
const QUADRANTS: Array<{ quadrant: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; arch: Arch; side: Side }> = [
  { quadrant: 1, arch: "UPPER", side: "RIGHT" },
  { quadrant: 2, arch: "UPPER", side: "LEFT" },
  { quadrant: 3, arch: "LOWER", side: "LEFT" },
  { quadrant: 4, arch: "LOWER", side: "RIGHT" },
  { quadrant: 5, arch: "UPPER", side: "RIGHT" },
  { quadrant: 6, arch: "UPPER", side: "LEFT" },
  { quadrant: 7, arch: "LOWER", side: "LEFT" },
  { quadrant: 8, arch: "LOWER", side: "RIGHT" },
];

function buildTeeth(): ToothInfo[] {
  const teeth: ToothInfo[] = [];
  for (const { quadrant, arch, side } of QUADRANTS) {
    const dentitionType: DentitionType = quadrant <= 4 ? "PERMANENT" : "DECIDUOUS";
    const count = dentitionType === "PERMANENT" ? 8 : 5;
    for (let position = 1; position <= count; position++) {
      teeth.push({
        fdi: `${quadrant}${position}`,
        dentitionType,
        arch,
        side,
        quadrant,
        positionInQuadrant: position,
      });
    }
  }
  return teeth;
}

export const ALL_TEETH: ToothInfo[] = buildTeeth();
export const PERMANENT_TEETH: ToothInfo[] = ALL_TEETH.filter((t) => t.dentitionType === "PERMANENT");
export const DECIDUOUS_TEETH: ToothInfo[] = ALL_TEETH.filter((t) => t.dentitionType === "DECIDUOUS");

const TEETH_BY_FDI = new Map<string, ToothInfo>(ALL_TEETH.map((t) => [t.fdi, t]));

export function getToothInfo(fdi: string): ToothInfo | undefined {
  return TEETH_BY_FDI.get(fdi);
}

export function isValidToothNumber(fdi: string): boolean {
  return TEETH_BY_FDI.has(fdi);
}

export function dentitionTypeForTooth(fdi: string): DentitionType | undefined {
  return TEETH_BY_FDI.get(fdi)?.dentitionType;
}

/** Premolars/molars have an occlusal table; incisors/canines don't (they meet edge-to-edge, an "incisal" edge instead). */
export function hasOcclusalSurface(fdi: string): boolean {
  const info = getToothInfo(fdi);
  return info !== undefined && info.positionInQuadrant >= 4;
}

/** Returns a translation key for the tooth's anatomical name — translate via t(`toothNames.${key}`), never displayed raw. */
export function toothNameKey(fdi: string): ToothNameKey | undefined {
  const info = TEETH_BY_FDI.get(fdi);
  if (!info) return undefined;
  const keys = info.dentitionType === "PERMANENT" ? PERMANENT_NAME_KEYS : DECIDUOUS_NAME_KEYS;
  return keys[info.positionInQuadrant - 1];
}

/** Upper-arch teeth in clinically intuitive left-to-right screen order (patient's right on the viewer's left). */
export function upperArchOrder(teeth: ToothInfo[]): ToothInfo[] {
  const right = teeth.filter((t) => t.arch === "UPPER" && t.side === "RIGHT").sort((a, b) => b.positionInQuadrant - a.positionInQuadrant);
  const left = teeth.filter((t) => t.arch === "UPPER" && t.side === "LEFT").sort((a, b) => a.positionInQuadrant - b.positionInQuadrant);
  return [...right, ...left];
}

/** Lower-arch teeth in clinically intuitive left-to-right screen order. */
export function lowerArchOrder(teeth: ToothInfo[]): ToothInfo[] {
  const right = teeth.filter((t) => t.arch === "LOWER" && t.side === "RIGHT").sort((a, b) => b.positionInQuadrant - a.positionInQuadrant);
  const left = teeth.filter((t) => t.arch === "LOWER" && t.side === "LEFT").sort((a, b) => a.positionInQuadrant - b.positionInQuadrant);
  return [...right, ...left];
}
