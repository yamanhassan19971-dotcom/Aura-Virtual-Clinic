"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppointmentType, Patient, Practitioner, Role, Room } from "@prisma/client";
import { Link, useRouter } from "@/i18n/navigation";
import { StatusBadge } from "@/components/diary/StatusBadge";
import { BookingModal } from "@/components/booking/BookingModal";
import { useToast } from "@/components/ui/Toast";
import { formatLongDate, formatTime, toDateParam } from "@/lib/time";
import type { AppointmentWithRelations } from "@/lib/services/appointment-service";

function AppointmentRow({ appointment, locale }: { appointment: AppointmentWithRelations; locale: string }) {
  return (
    <Link
      href={`/appointments?date=${toDateParam(appointment.startTime)}`}
      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 hover:bg-gray-50"
    >
      <div>
        <p className="text-sm font-medium text-[var(--color-text)]">{formatLongDate(appointment.startTime, locale)}</p>
        <p className="text-sm text-gray-500">
          <bdi dir="ltr">
            {formatTime(appointment.startTime, locale)}–{formatTime(appointment.endTime, locale)}
          </bdi>{" "}
          · {appointment.appointmentType.name} · {appointment.practitioner.name} · {appointment.room.name}
        </p>
      </div>
      <StatusBadge status={appointment.status} size="sm" />
    </Link>
  );
}

export function AppointmentsPanel({
  patient,
  upcoming,
  past,
  practitioners,
  rooms,
  appointmentTypes,
  canBook,
  currentUserRole,
}: {
  patient: Patient;
  upcoming: AppointmentWithRelations[];
  past: AppointmentWithRelations[];
  practitioners: Practitioner[];
  rooms: Room[];
  appointmentTypes: AppointmentType[];
  canBook: boolean;
  currentUserRole: Role;
}) {
  const t = useTranslations("patientAppointments");
  const tQuick = useTranslations("patient.quickActions");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [bookingOpen, setBookingOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 p-6">
      {upcoming.length === 0 && past.length === 0 && <p className="text-sm text-gray-400">{t("empty")}</p>}

      <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{t("upcoming")}</h3>
          {canBook && (
            <button
              type="button"
              onClick={() => setBookingOpen(true)}
              className="rounded-md bg-[var(--color-blue)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600"
            >
              {tQuick("bookAppointment")}
            </button>
          )}
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-400">{t("emptyUpcoming")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((a) => (
              <li key={a.id}>
                <AppointmentRow appointment={a} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">{t("past")}</h3>
        {past.length === 0 ? (
          <p className="text-sm text-gray-400">{t("emptyPast")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {past.map((a) => (
              <li key={a.id}>
                <AppointmentRow appointment={a} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {bookingOpen && (
        <BookingModal
          mode="create"
          draft={{
            practitionerId: practitioners[0]?.id ?? "",
            roomId: practitioners[0]?.defaultRoomId ?? rooms[0]?.id ?? "",
            startTime: new Date(),
          }}
          initialPatient={patient}
          practitioners={practitioners}
          rooms={rooms}
          appointmentTypes={appointmentTypes}
          currentUserRole={currentUserRole}
          onClose={() => setBookingOpen(false)}
          onCreated={() => {
            setBookingOpen(false);
            toast.show(tCommon("save"), { tone: "success" });
            router.refresh();
          }}
          onUpdated={() => setBookingOpen(false)}
        />
      )}
    </div>
  );
}
