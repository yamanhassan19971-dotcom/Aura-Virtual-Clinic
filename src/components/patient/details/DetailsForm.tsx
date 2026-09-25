"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Patient, Practitioner } from "@prisma/client";
import { updatePatientDetailsAction } from "@/lib/actions/patient-actions";
import { useToast } from "@/components/ui/Toast";
import { toDateParam } from "@/lib/time";
import { FamilySection, type FamilyEntry } from "@/components/patient/details/FamilySection";

const ACQUISITION_SOURCES = [
  "GOOGLE",
  "INSTAGRAM",
  "FACEBOOK",
  "WHATSAPP",
  "REFERRAL",
  "EXISTING_PATIENT",
  "WALK_IN",
  "OTHER",
];

type PatientWithNames = Patient & {
  preferredPractitioner: { name: string } | null;
  createdBy: { name: string } | null;
  updatedBy: { name: string } | null;
};

type FormState = {
  firstName: string;
  middleName: string;
  lastName: string;
  preferredName: string;
  title: string;
  gender: string;
  dateOfBirth: string;
  preferredLanguage: string;
  phone: string;
  homePhone: string;
  workPhone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  country: string;
  postalCode: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  emergencyContactNotes: string;
  preferredPractitionerId: string;
  acquisitionSource: string;
  preferredContactMethod: string;
  recallPreference: string;
};

function toFormState(patient: PatientWithNames): FormState {
  return {
    firstName: patient.firstName,
    middleName: patient.middleName ?? "",
    lastName: patient.lastName,
    preferredName: patient.preferredName ?? "",
    title: patient.title ?? "",
    gender: patient.gender ?? "",
    dateOfBirth: toDateParam(patient.dateOfBirth),
    preferredLanguage: patient.preferredLanguage ?? "",
    phone: patient.phone ?? "",
    homePhone: patient.homePhone ?? "",
    workPhone: patient.workPhone ?? "",
    email: patient.email ?? "",
    addressLine1: patient.addressLine1 ?? "",
    addressLine2: patient.addressLine2 ?? "",
    city: patient.city ?? "",
    country: patient.country ?? "",
    postalCode: patient.postalCode ?? "",
    emergencyContactName: patient.emergencyContactName ?? "",
    emergencyContactRelationship: patient.emergencyContactRelationship ?? "",
    emergencyContactPhone: patient.emergencyContactPhone ?? "",
    emergencyContactNotes: patient.emergencyContactNotes ?? "",
    preferredPractitionerId: patient.preferredPractitionerId ?? "",
    acquisitionSource: patient.acquisitionSource ?? "",
    preferredContactMethod: patient.preferredContactMethod ?? "",
    recallPreference: patient.recallPreference ?? "",
  };
}

function Field({
  label,
  value,
  onChange,
  disabled,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">{title}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

export function DetailsForm({
  patient,
  family,
  practitioners,
  startInEditMode,
  canEdit,
  canManageFamily,
}: {
  patient: PatientWithNames;
  family: FamilyEntry[];
  practitioners: Practitioner[];
  startInEditMode: boolean;
  canEdit: boolean;
  canManageFamily: boolean;
}) {
  const t = useTranslations("patientDetails");
  const tCommon = useTranslations("common");
  const tContactMethods = useTranslations("patientDetails.contactMethods");
  const tAcquisition = useTranslations("patientDetails.acquisitionSources");
  const locale = useLocale();
  const toast = useToast();

  const [editMode, setEditMode] = useState(startInEditMode);
  const [form, setForm] = useState<FormState>(toFormState(patient));
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (dirty) e.preventDefault();
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function cancelEdit() {
    setForm(toFormState(patient));
    setDirty(false);
    setEditMode(false);
  }

  async function handleSave() {
    setSubmitting(true);
    const result = await updatePatientDetailsAction({
      patientId: patient.id,
      ...form,
      dateOfBirth: form.dateOfBirth,
      preferredPractitionerId: form.preferredPractitionerId || null,
      preferredContactMethod: form.preferredContactMethod || null,
    });
    setSubmitting(false);
    if (result.ok) {
      setDirty(false);
      setEditMode(false);
      toast.show(tCommon("save"), { tone: "success" });
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {t("lastUpdated", {
            date: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
              patient.updatedAt
            ),
            name: patient.updatedBy?.name ?? "—",
          })}
        </p>
        {canEdit && !editMode && (
          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="rounded-md bg-[var(--color-blue)] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-blue-600"
          >
            {t("editDetails")}
          </button>
        )}
        {editMode && (
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs font-medium text-[var(--color-status-arrived)]">{t("unsavedChanges")}</span>}
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-md border border-[var(--color-border)] px-3.5 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSave}
              className="rounded-md bg-[var(--color-blue)] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
            >
              {t("saveChanges")}
            </button>
          </div>
        )}
      </div>

      <Section title={t("personalDetails")}>
        <Field label={t("firstName")} value={form.firstName} onChange={(v) => set("firstName", v)} disabled={!editMode} />
        <Field label={t("middleName")} value={form.middleName} onChange={(v) => set("middleName", v)} disabled={!editMode} />
        <Field label={t("lastName")} value={form.lastName} onChange={(v) => set("lastName", v)} disabled={!editMode} />
        <Field label={t("preferredName")} value={form.preferredName} onChange={(v) => set("preferredName", v)} disabled={!editMode} />
        <Field label={t("dob")} type="date" value={form.dateOfBirth} onChange={(v) => set("dateOfBirth", v)} disabled={!editMode} />
        <Field label={t("gender")} value={form.gender} onChange={(v) => set("gender", v)} disabled={!editMode} />
        <Field label={t("title_")} value={form.title} onChange={(v) => set("title", v)} disabled={!editMode} />
        <Field label={t("preferredLanguage")} value={form.preferredLanguage} onChange={(v) => set("preferredLanguage", v)} disabled={!editMode} />
      </Section>

      <Section title={t("contactDetails")}>
        <Field label={t("mobilePhone")} value={form.phone} onChange={(v) => set("phone", v)} disabled={!editMode} />
        <Field label={t("homePhone")} value={form.homePhone} onChange={(v) => set("homePhone", v)} disabled={!editMode} />
        <Field label={t("workPhone")} value={form.workPhone} onChange={(v) => set("workPhone", v)} disabled={!editMode} />
        <Field label={t("email")} type="email" value={form.email} onChange={(v) => set("email", v)} disabled={!editMode} />
        <Field label={t("addressLine1")} value={form.addressLine1} onChange={(v) => set("addressLine1", v)} disabled={!editMode} />
        <Field label={t("addressLine2")} value={form.addressLine2} onChange={(v) => set("addressLine2", v)} disabled={!editMode} />
        <Field label={t("city")} value={form.city} onChange={(v) => set("city", v)} disabled={!editMode} />
        <Field label={t("country")} value={form.country} onChange={(v) => set("country", v)} disabled={!editMode} />
        <Field label={t("postalCode")} value={form.postalCode} onChange={(v) => set("postalCode", v)} disabled={!editMode} />
      </Section>

      <Section title={t("emergencyContact")}>
        <Field label={t("emergencyName")} value={form.emergencyContactName} onChange={(v) => set("emergencyContactName", v)} disabled={!editMode} />
        <Field label={t("emergencyRelationship")} value={form.emergencyContactRelationship} onChange={(v) => set("emergencyContactRelationship", v)} disabled={!editMode} />
        <Field label={t("emergencyPhone")} value={form.emergencyContactPhone} onChange={(v) => set("emergencyContactPhone", v)} disabled={!editMode} />
        <Field label={t("emergencyNotes")} value={form.emergencyContactNotes} onChange={(v) => set("emergencyContactNotes", v)} disabled={!editMode} />
      </Section>

      <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-[var(--color-text)]">{t("practiceInfo")}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">{t("preferredPractitioner")}</span>
            <select
              value={form.preferredPractitionerId}
              disabled={!editMode}
              onChange={(e) => set("preferredPractitionerId", e.target.value)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm disabled:bg-gray-50"
            >
              <option value="">—</option>
              {practitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">{t("acquisitionSource")}</span>
            <select
              value={form.acquisitionSource}
              disabled={!editMode}
              onChange={(e) => set("acquisitionSource", e.target.value)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm disabled:bg-gray-50"
            >
              <option value="">—</option>
              {ACQUISITION_SOURCES.map((src) => (
                <option key={src} value={src}>
                  {tAcquisition(src as never)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">{t("preferredContactMethod")}</span>
            <select
              value={form.preferredContactMethod}
              disabled={!editMode}
              onChange={(e) => set("preferredContactMethod", e.target.value)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm disabled:bg-gray-50"
            >
              <option value="">—</option>
              {["PHONE", "WHATSAPP", "SMS", "EMAIL"].map((m) => (
                <option key={m} value={m}>
                  {tContactMethods(m as never)}
                </option>
              ))}
            </select>
          </label>
          <Field label={t("recallPreference")} value={form.recallPreference} onChange={(v) => set("recallPreference", v)} disabled={!editMode} />
        </div>
      </section>

      <FamilySection patientId={patient.id} family={family} canManage={canManageFamily} />
    </div>
  );
}
