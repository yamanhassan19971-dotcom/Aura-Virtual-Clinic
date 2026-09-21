import { DAY_END_MINUTE, DAY_START_MINUTE, pixelsPerMinute, type TimeScale } from "@/lib/time";

export function TimeAxis({ timeScale }: { timeScale: TimeScale }) {
  const ppm = pixelsPerMinute(timeScale);
  const totalHeight = (DAY_END_MINUTE - DAY_START_MINUTE) * ppm;
  const hours: number[] = [];
  for (let m = Math.ceil(DAY_START_MINUTE / 60) * 60; m <= DAY_END_MINUTE; m += 60) {
    hours.push(m);
  }

  return (
    <div className="sticky start-0 z-20 w-14 shrink-0 border-e border-[var(--color-border)] bg-white">
      <div className="h-[41px] border-b border-[var(--color-border)]" />
      <div className="relative" style={{ height: totalHeight }}>
        {hours.map((m) => (
          <div
            key={m}
            className="absolute end-1.5 -translate-y-1/2 text-[11px] font-medium text-gray-400"
            style={{ top: (m - DAY_START_MINUTE) * ppm }}
          >
            {String(Math.floor(m / 60)).padStart(2, "0")}:00
          </div>
        ))}
      </div>
    </div>
  );
}
