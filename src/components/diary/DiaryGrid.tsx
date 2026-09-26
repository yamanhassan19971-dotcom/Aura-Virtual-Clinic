"use client";

import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import type { Practitioner, WorkingHours } from "@prisma/client";
import type { AppointmentWithRelations } from "@/lib/services/appointment-service";
import { DAY_START_MINUTE, isSameDay, pixelsPerMinute, snapMinutes, type TimeScale } from "@/lib/time";
import { TimeAxis } from "@/components/diary/TimeAxis";
import { DiaryColumn } from "@/components/diary/DiaryColumn";
import { NowLine } from "@/components/diary/NowLine";

export function DiaryGrid({
  date,
  practitioners,
  appointmentsByPractitioner,
  timeScale,
  workingHours,
  onOpenAppointment,
  onSlotClick,
  onMove,
  onResize,
  canEdit,
  scrollContainerRef,
}: {
  date: Date;
  practitioners: Practitioner[];
  appointmentsByPractitioner: Map<string, AppointmentWithRelations[]>;
  timeScale: TimeScale;
  workingHours: WorkingHours[];
  onOpenAppointment: (id: string) => void;
  onSlotClick: (practitionerId: string, startMinute: number) => void;
  onMove: (appointmentId: string, practitionerId: string, minutesDelta: number) => void;
  onResize: (appointmentId: string, minutesDelta: number) => void;
  canEdit: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations("diary");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const weekday = date.getDay();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over, delta } = event;
    const data = active.data.current as { type: "move" | "resize"; appointmentId: string } | undefined;
    if (!data) return;
    const minutesDelta = snapMinutes(delta.y / pixelsPerMinute(timeScale), timeScale);

    if (data.type === "move") {
      const practitionerId = (over?.id as string) ?? null;
      if (!practitionerId || minutesDelta === 0) return;
      onMove(data.appointmentId, practitionerId, minutesDelta);
    } else if (data.type === "resize") {
      if (minutesDelta === 0) return;
      onResize(data.appointmentId, minutesDelta);
    }
  }

  if (practitioners.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
        {t("noPractitionersSelected")}
      </div>
    );
  }

  return (
    // A stable, static `id` is required here — without it, dnd-kit falls
    // back to a module-level mutable counter to generate the
    // aria-describedby id used by its screen-reader announcements. That
    // counter's value depends on how many other DndContext/useDraggable
    // instances have rendered before it in the same process, which differs
    // between the server's render pass and the client's fresh module
    // instantiation, causing a hydration mismatch
    // (e.g. server "DndDescribedBy-3" vs client "DndDescribedBy-0"). This
    // `id` prop is dnd-kit's own documented fix for SSR — see
    // https://docs.dndkit.com/api-documentation/context-provider#server-side-rendering.
    <DndContext id="diary-dnd-context" sensors={sensors} onDragEnd={handleDragEnd}>
      <div ref={scrollContainerRef} className="relative flex-1 overflow-auto">
        <div className="flex">
          <TimeAxis timeScale={timeScale} />
          <div className="relative flex flex-1">
            {practitioners.map((p) => {
              const dayHours = workingHours.find((w) => w.weekday === weekday);
              return (
                <DiaryColumn
                  key={p.id}
                  practitioner={p}
                  appointments={appointmentsByPractitioner.get(p.id) ?? []}
                  timeScale={timeScale}
                  workingStart={dayHours?.startMinute ?? DAY_START_MINUTE}
                  workingEnd={dayHours?.endMinute ?? DAY_START_MINUTE}
                  onOpenAppointment={onOpenAppointment}
                  onSlotClick={onSlotClick}
                  canEdit={canEdit}
                />
              );
            })}
            {isSameDay(date, new Date()) && (
              <div className="pointer-events-none absolute inset-0" style={{ top: 41 }}>
                <NowLine timeScale={timeScale} />
              </div>
            )}
          </div>
        </div>
      </div>
    </DndContext>
  );
}
