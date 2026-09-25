"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppointmentWithRelations } from "@/lib/services/appointment-service";
import { Link } from "@/i18n/navigation";
import { formatTime, minutesBetween, toDateParam } from "@/lib/time";

export function WaitingRoomPanel({
  appointments,
  onOpen,
}: {
  appointments: AppointmentWithRelations[];
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("waitingRoom");
  const locale = useLocale();
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const sorted = [...appointments].sort((a, b) => (a.arrivedAt?.getTime() ?? 0) - (b.arrivedAt?.getTime() ?? 0));

  return (
    <div data-testid="waiting-room-panel" className="border-b border-[var(--color-border)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">{t("title")}</h3>
        <span className="text-xs font-medium text-gray-400">{t("patientsWaiting", { count: sorted.length })}</span>
      </div>
      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((appt) => (
            <li key={appt.id} className="relative">
              <button
                type="button"
                onClick={() => onOpen(appt.id)}
                className="flex w-full flex-col items-start rounded-md border border-[var(--color-status-arrived)]/30 bg-[var(--color-status-arrived-bg)] px-3 py-2 text-start hover:brightness-95"
              >
                <span className="text-sm font-medium text-[var(--color-text)]">
                  {appt.patient.firstName} {appt.patient.lastName}
                </span>
                <span className="text-xs text-gray-500">{appt.practitioner.name}</span>
                <span className="text-xs font-semibold text-[var(--color-status-arrived)]">
                  {appt.arrivedAt && t("arrivedAt", { time: formatTime(appt.arrivedAt, locale) })}
                  {appt.arrivedAt && ` · ${t("waitingMinutes", { minutes: minutesBetween(appt.arrivedAt, new Date()) })}`}
                </span>
              </button>
              <Link
                href={`/patients/${appt.patientId}/overview?fromAppointment=${appt.id}&returnDate=${toDateParam(appt.startTime)}`}
                title="Open Patient"
                className="absolute end-2 top-2 text-xs font-medium text-[var(--color-status-arrived)] opacity-70 hover:underline hover:opacity-100"
              >
                ↗
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
