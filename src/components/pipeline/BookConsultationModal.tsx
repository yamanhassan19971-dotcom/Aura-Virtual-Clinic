"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatTime } from "@/lib/time";
import { bookLeadConsultationAction } from "@/lib/actions/pipeline-actions";
import { Modal } from "@/components/ui/Modal";
import { inputClass, labelClass, primaryButton, usePipelineAction } from "@/components/pipeline/usePipelineAction";

export type BookingOptions = {
  practitioners: { id: string; name: string; defaultRoomId: string | null }[];
  rooms: { id: string; name: string }[];
  types: { id: string; name: string; defaultDurationMin: number }[];
  matches: { id: string; name: string; patientCode: string; dateOfBirth: string }[];
};

function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

export function BookConsultationModal({
  leadId,
  leadName,
  options,
  defaultDate,
  onClose,
}: {
  leadId: string;
  leadName: string;
  options: BookingOptions;
  defaultDate: string;
  onClose: () => void;
}) {
  const t = useTranslations("pipeline.leads.book");
  const locale = useLocale();
  const [conflict, setConflict] = useState<string | null>(null);
  const { run, pending } = usePipelineAction();
  const consultType = options.types.find((x) => /consult/i.test(x.name)) ?? options.types[0];
  const firstDoctor = options.practitioners[0];
  const name = splitName(leadName);

  const [patientId, setPatientId] = useState<string>(options.matches[0]?.id ?? "");
  const [firstName, setFirstName] = useState(name.first);
  const [lastName, setLastName] = useState(name.last);
  const [dob, setDob] = useState("");
  const [age, setAge] = useState("");
  const [practitionerId, setPractitionerId] = useState(firstDoctor?.id ?? "");
  const [roomId, setRoomId] = useState(firstDoctor?.defaultRoomId ?? options.rooms[0]?.id ?? "");
  const [typeId, setTypeId] = useState(consultType?.id ?? "");
  const [duration, setDuration] = useState(consultType?.defaultDurationMin ?? 30);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("18:00");

  function chooseDoctor(id: string) {
    setPractitionerId(id);
    const room = options.practitioners.find((p) => p.id === id)?.defaultRoomId;
    if (room) setRoomId(room);
  }

  function chooseType(id: string) {
    setTypeId(id);
    const type = options.types.find((x) => x.id === id);
    if (type) setDuration(type.defaultDurationMin);
  }

  // Age is easier to ask on the phone than a birth date; it files 1 January of that year.
  const dateOfBirth = dob || (age ? `${new Date().getFullYear() - Number(age)}-01-01` : "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setConflict(null);
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    const startTime = new Date(y, m - 1, d, hh, mm);
    const result = await run(
      () =>
        bookLeadConsultationAction({
          leadId,
          patientId: patientId || null,
          ...(patientId ? {} : { firstName, lastName, dateOfBirth }),
          practitionerId,
          roomId,
          appointmentTypeId: typeId,
          startTime: startTime.toISOString(),
          durationMin: duration,
        }),
      {
        success: t("booked"),
        onError: (r) => {
          if (r.kind !== "CONFLICT" || !r.conflict) return false;
          setConflict(
            t("conflict", {
              doctor: r.conflict.practitionerName,
              patient: `${r.conflict.patientName} (${formatTime(new Date(r.conflict.startTime), locale)})`,
            })
          );
          return true;
        },
      }
    );
    if (result) onClose();
  }

  return (
    <Modal title={t("title")} onClose={onClose} width="lg">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {options.matches.length > 0 && (
          <fieldset className="flex flex-col gap-1.5 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm">
            <legend className="px-1 text-xs font-semibold text-amber-800">{t("existing")}</legend>
            {options.matches.map((p) => (
              <label key={p.id} className="flex items-center gap-2">
                <input type="radio" name="patient" checked={patientId === p.id} onChange={() => setPatientId(p.id)} />
                <span>
                  {p.name} <span className="text-gray-400" dir="ltr">({p.patientCode}, {p.dateOfBirth})</span>
                </span>
              </label>
            ))}
            <label className="flex items-center gap-2">
              <input type="radio" name="patient" checked={patientId === ""} onChange={() => setPatientId("")} />
              {t("newPatient")}
            </label>
          </fieldset>
        )}

        {!patientId && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className={labelClass}>
              {t("firstName")}
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              {t("lastName")}
              <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            </label>
            <label className={labelClass}>
              {t("dob")}
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required={!age} className={inputClass} />
            </label>
            <label className={labelClass}>
              {t("age")}
              <input
                type="number"
                min={1}
                max={110}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                disabled={!!dob}
                className={inputClass}
              />
            </label>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className={labelClass}>
            {t("doctor")}
            <select value={practitionerId} onChange={(e) => chooseDoctor(e.target.value)} className={inputClass}>
              {options.practitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            {t("type")}
            <select value={typeId} onChange={(e) => chooseType(e.target.value)} className={inputClass}>
              {options.types.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            {t("room")}
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className={inputClass}>
              {options.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            {t("date")}
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            {t("time")}
            <input type="time" required step={300} value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            {t("duration")}
            <input
              type="number"
              min={5}
              max={480}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className={inputClass}
            />
          </label>
        </div>

        {conflict && (
          <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {conflict}
          </p>
        )}
        <div className="flex justify-end">
          <button type="submit" disabled={pending} className={primaryButton}>
            {t("submit")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
