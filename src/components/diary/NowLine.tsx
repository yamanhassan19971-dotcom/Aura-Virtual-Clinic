"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { DAY_START_MINUTE, minutesSinceMidnight, pixelsPerMinute, type TimeScale } from "@/lib/time";

export function NowLine({ timeScale }: { timeScale: TimeScale }) {
  const t = useTranslations("diary");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const minute = minutesSinceMidnight(now);
  const top = (minute - DAY_START_MINUTE) * pixelsPerMinute(timeScale);
  if (top < 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top }}>
      <div className="flex items-center">
        <span className="rounded-full bg-[var(--color-status-fta)] px-1.5 py-0.5 text-[9px] font-bold text-white">
          {t("now")}
        </span>
        <div className="h-px flex-1 bg-[var(--color-status-fta)]" />
      </div>
    </div>
  );
}
