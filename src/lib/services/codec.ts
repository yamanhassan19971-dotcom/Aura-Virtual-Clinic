// Shared "<code>::<free text>" encoding used wherever a reason/label needs
// both a translatable code and an optional human-written detail, without
// adding a second database column (appointment cancel/FTA reasons, medical
// alert labels).
export function encodeReason(code: string, notes?: string | null): string {
  return notes && notes.trim().length > 0 ? `${code}::${notes.trim()}` : code;
}

export function decodeReason(value: string | null): { code: string; notes: string | null } {
  if (!value) return { code: "", notes: null };
  const idx = value.indexOf("::");
  if (idx === -1) return { code: value, notes: null };
  return { code: value.slice(0, idx), notes: value.slice(idx + 2) };
}
