"use client";

import { useDraggable } from "@dnd-kit/core";
import { useLocale, useTranslations } from "next-intl";
import type { AppointmentWithRelations } from "@/lib/services/appointment-service";
import { Link } from "@/i18n/navigation";
import { formatTime, toDateParam } from "@/lib/time";
import { STATUS_COLOR_VAR, STATUS_GLYPH } from "@/components/diary/status-meta";

export function AppointmentCard({
  appointment,
  top,
  height,
  onOpen,
  disabled,
}: {
  appointment: AppointmentWithRelations;
  top: number;
  height: number;
  onOpen: (id: string) => void;
  disabled?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("status");
  const colors = STATUS_COLOR_VAR[appointment.status];

  const move = useDraggable({
    id: appointment.id,
    data: { type: "move", appointmentId: appointment.id },
    disabled,
  });
  const resize = useDraggable({
    id: `${appointment.id}::resize`,
    data: { type: "resize", appointmentId: appointment.id },
    disabled,
  });

  const isTiny = height < 34;
  const isSmall = height < 54;
  const dimmed = appointment.status === "CANCELLED" || appointment.status === "FTA";

  const style: React.CSSProperties = {
    top,
    height: Math.max(height, 16),
    borderInlineStartColor: colors.fg,
    backgroundColor: colors.bg,
    opacity: move.isDragging ? 0.5 : dimmed ? 0.75 : 1,
    zIndex: move.isDragging || resize.isDragging ? 30 : 10,
  };

  return (
    <div
      ref={move.setNodeRef}
      style={style}
      data-testid="appointment-card"
      data-appointment-id={appointment.id}
      data-patient={`${appointment.patient.firstName} ${appointment.patient.lastName}`}
      data-status={appointment.status}
      className="group absolute inset-x-0.5 overflow-hidden rounded-md border-s-4 bg-white text-start shadow-sm"
    >
      <button
        type="button"
        {...move.listeners}
        {...move.attributes}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(appointment.id);
        }}
        className="flex h-full w-full flex-col items-start gap-0 px-1.5 py-1 text-start"
      >
        <span className="w-full truncate text-[11px] font-semibold text-[var(--color-text)]">
          {appointment.patient.firstName} {appointment.patient.lastName}
        </span>
        {!isTiny && (
          <span className="w-full truncate text-[10px] text-gray-600">{appointment.appointmentType.name}</span>
        )}
        {!isSmall && (
          <span className="w-full truncate text-[10px] text-gray-500">
            <bdi dir="ltr">
              {formatTime(appointment.startTime, locale)}–{formatTime(appointment.endTime, locale)}
            </bdi>{" "}
            · {appointment.room.name}
          </span>
        )}
        <span
          className="mt-auto inline-flex items-center gap-1 truncate text-[10px] font-bold"
          style={{ color: colors.fg }}
        >
          <span aria-hidden>{STATUS_GLYPH[appointment.status]}</span>
          {!isTiny && <span>{t(appointment.status)}</span>}
        </span>
      </button>

      {!isTiny && (
        <Link
          href={`/patients/${appointment.patientId}/overview?fromAppointment=${appointment.id}&returnDate=${toDateParam(appointment.startTime)}`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          title="Open Patient"
          data-testid="appointment-open-patient"
          className="absolute end-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded text-[10px] text-gray-400 opacity-0 hover:bg-gray-100 hover:text-[var(--color-blue)] group-hover:opacity-100"
        >
          ↗
        </Link>
      )}

      {!disabled && (
        <div
          ref={resize.setNodeRef}
          {...resize.listeners}
          {...resize.attributes}
          onClick={(e) => e.stopPropagation()}
          data-testid="appointment-resize-handle"
          className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100"
          style={{ backgroundColor: colors.fg }}
          aria-hidden
        />
      )}
    </div>
  );
}
