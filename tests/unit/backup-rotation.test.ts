import { describe, expect, it } from "vitest";
import { dumpsToDelete } from "../../scripts/clinic/common.mjs";

function dailyDumps(from: Date, days: number) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const p = (n: number) => String(n).padStart(2, "0");
    return `aura-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_2130.dump`;
  });
}

describe("backup rotation", () => {
  it("keeps 30 days of daily dumps, then the newest dump of each month for 12 months", () => {
    const names = dailyDumps(new Date(2025, 0, 1), 658); // 2025-01-01 .. 2026-10-20
    const now = new Date(2026, 9, 20, 22);
    const deleted = new Set<string>(dumpsToDelete(names, now, 30, 12));
    const kept = names.filter((n) => !deleted.has(n));

    expect(kept).toContain("aura-2026-10-20_2130.dump");
    expect(kept).toContain("aura-2026-09-21_2130.dump"); // 29 days ago
    expect(kept).not.toContain("aura-2026-09-15_2130.dump");
    expect(kept).toContain("aura-2026-08-31_2130.dump"); // end of August
    expect(kept).toContain("aura-2025-11-30_2130.dump"); // 12th month back
    expect(kept).not.toContain("aura-2025-10-31_2130.dump");
    // October and September already have dumps inside the 30 days; Aug 2026 back to Nov 2025 add 10.
    expect(kept.length).toBe(30 + 10);
  });

  it("ignores files that aren't dumps", () => {
    expect(dumpsToDelete(["notes.txt", "backup-status.json"], new Date(), 30, 12)).toEqual([]);
  });
});
