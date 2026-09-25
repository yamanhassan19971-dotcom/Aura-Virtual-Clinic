"use client";

import { useLocale, useTranslations } from "next-intl";
import type { AppointmentWithRelations } from "@/lib/services/appointment-service";
import { Link } from "@/i18n/navigation";
import { formatTime, toDateParam } from "@/lib/time";

export function InSurgeryPanel({
  appointments,
  onOpen,
}: {
  appointments: AppointmentWithRelations[];
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("inSurgery");
  const locale = useLocale();
  const sorted = [...appointments].sort((a, b) => (a.inSurgeryAt?.getTime() ?? 0) - (b.inSurgeryAt?.getTime() ?? 0));

  return (
    <div data-testid="in-surgery-panel" className="p-4">
      <h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">{t("title")}</h3>
      {sorted.length === 0 ? (
        <p className="text-xs text-gray-400">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((appt) => (
            <li key={appt.id} className="relative">
              <button
                type="button"
                onClick={() => onOpen(appt.id)}
                className="flex w-full flex-col items-start rounded-md border border-[var(--color-status-insurgery)]/30 bg-[var(--color-status-insurgery-bg)] px-3 py-2 text-start hover:brightness-95"
              >
                <span className="text-xs font-semibold text-gray-500">{appt.practitioner.name}</span>
                <span className="text-sm font-medium text-[var(--color-text)]">
                  {appt.patient.firstName} {appt.patient.lastName}
                </span>
                <span className="text-xs font-semibold text-[var(--color-status-insurgery)]">
                  {appt.inSurgeryAt && t("startedAt", { time: formatTime(appt.inSurgeryAt, locale) })}
                </span>
              </button>
              <Link
                href={`/patients/${appt.patientId}/overview?fromAppointment=${appt.id}&returnDate=${toDateParam(appt.startTime)}`}
                title="Open Patient"
                className="absolute end-2 top-2 text-xs font-medium text-[var(--color-status-insurgery)] opacity-70 hover:underline hover:opacity-100"
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
