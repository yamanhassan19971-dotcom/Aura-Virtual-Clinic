"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { AppointmentType, Patient, Practitioner, Role, Room } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { PatientSearchField } from "@/components/booking/PatientSearchField";
import { NewPatientModal } from "@/components/booking/NewPatientModal";
import { ConflictDialog } from "@/components/booking/ConflictDialog";
import { createAppointmentAction, updateAppointmentAction } from "@/lib/actions/appointment-actions";
import type { ActionResult, ConflictInfo } from "@/lib/actions/action-result";
import type { AppointmentWithRelations } from "@/lib/services/appointment-service";
import { can } from "@/lib/permissions";
import { toDateParam } from "@/lib/time";

export type BookingDraft = {
  practitionerId: string;
  roomId: string;
  startTime: Date;
};

export function BookingModal({
  mode,
  draft,
  appointment,
  initialPatient,
  practitioners,
  rooms,
  appointmentTypes,
  currentUserRole,
  onClose,
  onCreated,
  onUpdated,
}: {
  mode: "create" | "edit";
  draft?: BookingDraft;
  appointment?: AppointmentWithRelations;
  /** Pre-selects the patient (skipping search) — used when booking is launched from that patient's own record. */
  initialPatient?: Patient;
  practitioners: Practitioner[];
  rooms: Room[];
  appointmentTypes: AppointmentType[];
  currentUserRole: Role;
  onClose: () => void;
  onCreated: (appt: AppointmentWithRelations) => void;
  onUpdated: (appt: AppointmentWithRelations) => void;
}) {
  const t = useTranslations("booking");
  const tStatus = useTranslations("status");
  const initialStart = appointment?.startTime ?? draft?.startTime ?? new Date();

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(
    appointment?.patient ?? initialPatient ?? null
  );
  const [practitionerId, setPractitionerId] = useState(appointment?.practitionerId ?? draft?.practitionerId ?? practitioners[0]?.id ?? "");
  const [roomId, setRoomId] = useState(appointment?.roomId ?? draft?.roomId ?? rooms[0]?.id ?? "");
  const [appointmentTypeId, setAppointmentTypeId] = useState(appointment?.appointmentTypeId ?? appointmentTypes[0]?.id ?? "");
  const [durationMin, setDurationMin] = useState(
    appointment?.durationMin ?? appointmentTypes[0]?.defaultDurationMin ?? 30
  );
  const [durationTouched, setDurationTouched] = useState(mode === "edit");
  const [dateStr, setDateStr] = useState(toDateParam(initialStart));
  const [timeStr, setTimeStr] = useState(
    `${String(initialStart.getHours()).padStart(2, "0")}:${String(initialStart.getMinutes()).padStart(2, "0")}`
  );
  const [status, setStatus] = useState<"PENDING" | "CONFIRMED">((appointment?.status as "PENDING" | "CONFIRMED") ?? "PENDING");
  const [notes, setNotes] = useState(appointment?.notes ?? "");
  const [newPatientQuery, setNewPatientQuery] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canOverride = can(currentUserRole, "appointments.overrideConflict");

  const filteredRooms = useMemo(() => rooms, [rooms]);

  function handleTypeChange(id: string) {
    setAppointmentTypeId(id);
    if (!durationTouched) {
      const type = appointmentTypes.find((t2) => t2.id === id);
      if (type) setDurationMin(type.defaultDurationMin);
    }
  }

  async function submit(overrideReason?: string) {
    if (!selectedPatient) {
      setError(t("selectPatient"));
      return;
    }
    setSubmitting(true);
    setError(null);
    const startTime = new Date(`${dateStr}T${timeStr}:00`);

    const basePayload = {
      patientId: selectedPatient.id,
      practitionerId,
      roomId,
      appointmentTypeId,
      startTime,
      durationMin,
      notes: notes || null,
      overrideConflict: overrideReason !== undefined,
      overrideReason,
    };

    let result: ActionResult<AppointmentWithRelations>;
    if (mode === "create") {
      result = await createAppointmentAction({ ...basePayload, status });
    } else {
      result = await updateAppointmentAction({ appointmentId: appointment!.id, ...basePayload });
    }

    setSubmitting(false);
    if (result.ok) {
      setConflict(null);
      if (mode === "create") {
        onCreated(result.data);
      } else {
        onUpdated(result.data);
      }
    } else if (result.kind === "CONFLICT" && result.conflict) {
      setConflict(result.conflict);
    } else {
      setError(result.message);
    }
  }

  if (conflict) {
    return (
      <ConflictDialog
        conflict={conflict}
        canOverride={canOverride}
        submitting={submitting}
        onClose={() => setConflict(null)}
        onOverride={(reason) => submit(reason || "Override")}
      />
    );
  }

  if (newPatientQuery !== null) {
    return (
      <NewPatientModal
        prefillName={newPatientQuery}
        onClose={() => setNewPatientQuery(null)}
        onCreated={(patient) => {
          setSelectedPatient(patient);
          setNewPatientQuery(null);
        }}
      />
    );
  }

  return (
    <Modal title={mode === "create" ? t("titleNew") : t("titleEdit")} onClose={onClose} width="md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-3"
      >
        <div>
          <span className="mb-1 block text-sm font-medium text-gray-700">{t("patient")}</span>
          <PatientSearchField
            selectedPatient={selectedPatient}
            onSelect={setSelectedPatient}
            onRequestNewPatient={(q) => setNewPatientQuery(q)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {t("date")}
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {t("time")}
            <input
              type="time"
              value={timeStr}
              onChange={(e) => setTimeStr(e.target.value)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {t("reason")}
            <select
              value={appointmentTypeId}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              {appointmentTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {t("duration")}
            <input
              type="number"
              min={5}
              max={480}
              step={5}
              value={durationMin}
              onChange={(e) => {
                setDurationTouched(true);
                setDurationMin(Number(e.target.value));
              }}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {t("practitioner")}
            <select
              value={practitionerId}
              onChange={(e) => setPractitionerId(e.target.value)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              {practitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {t("room")}
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              {filteredRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {mode === "create" && (
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {t("status")}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "PENDING" | "CONFIRMED")}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              <option value="PENDING">{tStatus("PENDING")}</option>
              <option value="CONFIRMED">{tStatus("CONFIRMED")}</option>
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("notes")}
          <textarea
            value={notes ?? ""}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          />
        </label>

        {error && <p className="text-sm text-[var(--color-status-fta)]">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            {t("cancelBtn")}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-[var(--color-blue)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            {mode === "create" ? t("bookBtn") : t("saveBtn")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
