"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import type { AppointmentType, MedicalAlert, Patient, PatientFlag, Practitioner, Role, Room } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { ChevronIcon } from "@/components/shell/icons";
import { AlertBadge } from "@/components/patient/AlertBadge";
import { FlagBadge } from "@/components/patient/FlagBadge";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { can } from "@/lib/permissions";
import { calcAge, formatLongDate, formatTime } from "@/lib/time";
import { setPatientStatusAction } from "@/lib/actions/patient-actions";
import { getAppointmentByIdAction } from "@/lib/actions/query-actions";
import { BookingModal } from "@/components/booking/BookingModal";
import type { AppointmentWithRelations } from "@/lib/services/appointment-service";

export function PatientHeaderBar({
  patient,
  alerts,
  flags,
  practitioners,
  rooms,
  appointmentTypes,
  currentUserRole,
}: {
  patient: Patient;
  alerts: MedicalAlert[];
  flags: PatientFlag[];
  practitioners: Practitioner[];
  rooms: Room[];
  appointmentTypes: AppointmentType[];
  currentUserRole: Role;
}) {
  const t = useTranslations("patient");
  const tCommon = useTranslations("common");
  const tQuick = useTranslations("patient.quickActions");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  // Layouts don't receive searchParams from Next.js — read the URL directly
  // instead, so "Back to Diary" and the current-appointment banner survive
  // navigation between tabs without every page having to re-derive them.
  const searchParams = useSearchParams();
  const returnDate = searchParams.get("returnDate") ?? "";
  const fromAppointment = searchParams.get("fromAppointment");

  const [bookingOpen, setBookingOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(patient.status);
  const [currentAppointment, setCurrentAppointment] = useState<AppointmentWithRelations | null>(null);

  useEffect(() => {
    if (!fromAppointment) {
      setCurrentAppointment(null);
      return;
    }
    let cancelled = false;
    getAppointmentByIdAction(fromAppointment).then((appt) => {
      if (!cancelled && appt && appt.patientId === patient.id) setCurrentAppointment(appt);
    });
    return () => {
      cancelled = true;
    };
  }, [fromAppointment, patient.id]);

  const age = calcAge(patient.dateOfBirth);

  const canBook = can(currentUserRole, "appointments.create");
  const canEditDemo = can(currentUserRole, "patients.editDemographics");
  const canViewChart = can(currentUserRole, "patients.viewClinical");
  const canMedical = can(currentUserRole, "patients.manageMedicalHistory");
  const canClinicalNotes = can(currentUserRole, "patients.manageClinicalNotes");
  const canDocs = can(currentUserRole, "patients.manageDocuments");
  const canAdminNotes = can(currentUserRole, "patients.manageAdminNotes");
  const canArchive = can(currentUserRole, "patients.archive");

  async function handleArchiveToggle() {
    setSubmitting(true);
    const nextStatus = status === "ARCHIVED" ? "ACTIVE" : "ARCHIVED";
    const result = await setPatientStatusAction({ patientId: patient.id, status: nextStatus });
    setSubmitting(false);
    setArchiveOpen(false);
    if (result.ok) {
      setStatus(result.data.status);
      toast.show(tCommon("save"), { tone: "success" });
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  return (
    <div className="border-b border-[var(--color-border)] bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-4">
        <div>
          <Link
            href={`/appointments${returnDate ? `?date=${returnDate}` : ""}`}
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-blue)] hover:underline"
          >
            <ChevronIcon className="rtl:rotate-180" width={12} height={12} /> {t("backToDiary")}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-[var(--color-text)]">
              {patient.firstName} {patient.lastName}
            </h1>
            {status !== "ACTIVE" && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                {t(`status.${status}`)}
              </span>
            )}
            {alerts.map((a) => (
              <AlertBadge key={a.id} label={a.label} />
            ))}
            {flags.map((f) => (
              <FlagBadge key={f.id} flagKey={f.flagKey} />
            ))}
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-gray-500">
            <span>{tCommon("patientId")}: {patient.patientCode}</span>
            <span>{t("age", { age })}</span>
            <bdi dir="ltr">{new Intl.DateTimeFormat(locale).format(patient.dateOfBirth)}</bdi>
            {patient.phone && <bdi dir="ltr">{patient.phone}</bdi>}
            {patient.email && <span>{patient.email}</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canBook && (
            <button
              type="button"
              onClick={() => setBookingOpen(true)}
              className="rounded-md bg-[var(--color-blue)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600"
            >
              {tQuick("bookAppointment")}
            </button>
          )}
          {canEditDemo && (
            <Link
              href={`/patients/${patient.id}/details?edit=1`}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              {tQuick("editDetails")}
            </Link>
          )}
          {canViewChart && (
            <Link
              href={`/patients/${patient.id}/chart`}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              {tQuick("openChart")}
            </Link>
          )}
          {canMedical && (
            <Link
              href={`/patients/${patient.id}/medical?new=1`}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              {tQuick("newMedicalHistory")}
            </Link>
          )}
          {canAdminNotes && (
            <Link
              href={`/patients/${patient.id}/notes?new=1`}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              {tQuick("addNote")}
            </Link>
          )}
          {canDocs && (
            <Link
              href={`/patients/${patient.id}/documents?upload=1`}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              {tQuick("uploadDocument")}
            </Link>
          )}
          {canClinicalNotes && (
            <Link
              href={`/patients/${patient.id}/history?new=1`}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              {tQuick("createClinicalNote")}
            </Link>
          )}
          {canArchive && (
            <button
              type="button"
              onClick={() => setArchiveOpen(true)}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50"
            >
              {status === "ARCHIVED" ? t("reactivatePatient") : t("archivePatient")}
            </button>
          )}
        </div>
      </div>

      {currentAppointment && (
        <div className="border-t border-[var(--color-status-confirmed)]/20 bg-[var(--color-status-confirmed-bg)] px-6 py-2 text-sm text-[var(--color-status-confirmed)]">
          <span className="font-semibold">{t("currentAppointment")}:</span>{" "}
          {formatLongDate(currentAppointment.startTime, locale)} ·{" "}
          <bdi dir="ltr">
            {formatTime(currentAppointment.startTime, locale)}–{formatTime(currentAppointment.endTime, locale)}
          </bdi>{" "}
          · {currentAppointment.appointmentType.name} · {currentAppointment.practitioner.name} ·{" "}
          {currentAppointment.room.name}
        </div>
      )}

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

      {archiveOpen && (
        <Modal title={status === "ARCHIVED" ? t("reactivatePatient") : t("archivePatient")} onClose={() => setArchiveOpen(false)} width="sm">
          <p className="mb-4 text-sm text-gray-600">{t("archiveConfirm")}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setArchiveOpen(false)}
              className="rounded-md border border-[var(--color-border)] px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleArchiveToggle}
              className="rounded-md bg-[var(--color-navy)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-navy-light)] disabled:opacity-60"
            >
              {tCommon("confirm")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
