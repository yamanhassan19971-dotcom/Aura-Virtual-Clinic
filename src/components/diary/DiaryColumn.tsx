"use client";

import { useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import type { Practitioner } from "@prisma/client";
import type { AppointmentWithRelations } from "@/lib/services/appointment-service";
import {
  DAY_END_MINUTE,
  DAY_START_MINUTE,
  minutesSinceMidnight,
  pixelsPerMinute,
  type TimeScale,
} from "@/lib/time";
import { AppointmentCard } from "@/components/diary/AppointmentCard";

const MIN_GAP_MINUTES = 20;

export function DiaryColumn({
  practitioner,
  appointments,
  timeScale,
  workingStart,
  workingEnd,
  onOpenAppointment,
  onSlotClick,
  canEdit,
}: {
  practitioner: Practitioner;
  appointments: AppointmentWithRelations[];
  timeScale: TimeScale;
  workingStart: number;
  workingEnd: number;
  onOpenAppointment: (id: string) => void;
  onSlotClick: (practitionerId: string, startMinute: number) => void;
  canEdit: boolean;
}) {
  const t = useTranslations("diary");
  const ppm = pixelsPerMinute(timeScale);
  const totalHeight = (DAY_END_MINUTE - DAY_START_MINUTE) * ppm;

  const droppable = useDroppable({ id: practitioner.id, data: { practitionerId: practitioner.id } });

  const gaps = useMemo(() => {
    const sorted = [...appointments]
      .filter((a) => a.status !== "CANCELLED")
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    const result: Array<{ start: number; end: number }> = [];
    let cursor = workingStart;
    for (const appt of sorted) {
      const start = minutesSinceMidnight(appt.startTime);
      const end = minutesSinceMidnight(appt.endTime);
      if (start > cursor + MIN_GAP_MINUTES) {
        result.push({ start: cursor, end: start });
      }
      cursor = Math.max(cursor, end);
    }
    if (workingEnd > cursor + MIN_GAP_MINUTES) {
      result.push({ start: cursor, end: workingEnd });
    }
    return result;
  }, [appointments, workingStart, workingEnd]);

  function handleBackgroundClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!canEdit) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minute = DAY_START_MINUTE + y / ppm;
    const snapped = Math.round(minute / timeScale) * timeScale;
    onSlotClick(practitioner.id, snapped);
  }

  return (
    <div className="flex min-w-[190px] flex-1 flex-col border-e border-[var(--color-border)] last:border-e-0">
      <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-[var(--color-border)] bg-white px-3 py-2">
        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: practitioner.colorHex }} />
        <span className="truncate text-sm font-semibold text-[var(--color-text)]">{practitioner.name}</span>
      </div>
      <div
        ref={droppable.setNodeRef}
        onClick={handleBackgroundClick}
        data-testid="diary-column"
        data-practitioner-id={practitioner.id}
        data-practitioner-name={practitioner.name}
        className={`relative ${droppable.isOver ? "bg-blue-50" : ""}`}
        style={{ height: totalHeight }}
      >
        {/* working-hours shading */}
        <div
          className="pointer-events-none absolute inset-x-0 bg-gray-100"
          style={{ top: 0, height: Math.max(0, (workingStart - DAY_START_MINUTE) * ppm) }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bg-gray-100"
          style={{
            top: (workingEnd - DAY_START_MINUTE) * ppm,
            height: Math.max(0, (DAY_END_MINUTE - workingEnd) * ppm),
          }}
        />

        {gaps.map((gap, i) => (
          <div
            key={i}
            className="pointer-events-none absolute inset-x-1 flex items-center justify-center rounded border border-dashed border-gray-300"
            style={{
              top: (gap.start - DAY_START_MINUTE) * ppm + 1,
              height: (gap.end - gap.start) * ppm - 2,
            }}
          >
            {gap.end - gap.start >= 40 && (
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{t("gapLabel")}</span>
            )}
          </div>
        ))}

        {appointments.map((appt) => (
          <AppointmentCard
            key={appt.id}
            appointment={appt}
            top={(minutesSinceMidnight(appt.startTime) - DAY_START_MINUTE) * ppm}
            height={(minutesSinceMidnight(appt.endTime) - minutesSinceMidnight(appt.startTime)) * ppm}
            onOpen={onOpenAppointment}
            disabled={!canEdit}
          />
        ))}
      </div>
    </div>
  );
}
