import type { AppointmentStatus } from "@prisma/client";

// Every status carries a colour AND a distinct icon shape, so meaning never
// depends on colour perception alone (spec section 21 / 14).
export const STATUS_ORDER: AppointmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "ARRIVED",
  "IN_SURGERY",
  "COMPLETED",
  "CANCELLED",
  "FTA",
];

export const STATUS_COLOR_VAR: Record<AppointmentStatus, { fg: string; bg: string }> = {
  PENDING: { fg: "var(--color-status-pending)", bg: "var(--color-status-pending-bg)" },
  CONFIRMED: { fg: "var(--color-status-confirmed)", bg: "var(--color-status-confirmed-bg)" },
  ARRIVED: { fg: "var(--color-status-arrived)", bg: "var(--color-status-arrived-bg)" },
  IN_SURGERY: { fg: "var(--color-status-insurgery)", bg: "var(--color-status-insurgery-bg)" },
  COMPLETED: { fg: "var(--color-status-completed)", bg: "var(--color-status-completed-bg)" },
  CANCELLED: { fg: "var(--color-status-cancelled)", bg: "var(--color-status-cancelled-bg)" },
  FTA: { fg: "var(--color-status-fta)", bg: "var(--color-status-fta-bg)" },
};

// Simple glyphs (not full icon components) so status badges stay legible
// even at very small card sizes; distinct silhouettes, not just colour.
export const STATUS_GLYPH: Record<AppointmentStatus, string> = {
  PENDING: "○", // hollow circle — not yet confirmed
  CONFIRMED: "✓", // check
  ARRIVED: "→", // arrow in
  IN_SURGERY: "⊕", // medical cross-in-circle
  COMPLETED: "✔", // heavy check
  CANCELLED: "✕", // x
  FTA: "⚠", // warning triangle
};
