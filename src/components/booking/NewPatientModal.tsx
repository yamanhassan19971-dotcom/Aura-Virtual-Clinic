"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Patient } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { createPatientAction } from "@/lib/actions/appointment-actions";
import { DuplicatePatientDialog } from "@/components/booking/DuplicatePatientDialog";
import type { DuplicatePatientInfo } from "@/lib/actions/action-result";

export function NewPatientModal({
  prefillName,
  onClose,
  onCreated,
}: {
  prefillName: string;
  onClose: () => void;
  onCreated: (patient: Patient) => void;
}) {
  const t = useTranslations("newPatient");
  const tCommon = useTranslations("common");
  const parts = prefillName.trim().split(/\s+/);
  const [firstName, setFirstName] = useState(parts[0] ?? "");
  const [lastName, setLastName] = useState(parts.slice(1).join(" "));
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicatePatientInfo[] | null>(null);

  async function submit(overrideDuplicateCheck: boolean) {
    setSubmitting(true);
    setError(null);
    const result = await createPatientAction({
      firstName,
      lastName,
      dateOfBirth: dob,
      phone: phone || null,
      email: email || null,
      overrideDuplicateCheck,
    });
    setSubmitting(false);
    if (result.ok) {
      setDuplicates(null);
      onCreated(result.data);
    } else if (result.kind === "DUPLICATE_PATIENT" && result.duplicates) {
      setDuplicates(result.duplicates);
    } else {
      setError(result.message);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(false);
  }

  return (
    <>
    <Modal title={t("title")} onClose={onClose} width="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {t("firstName")}
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            {t("lastName")}
            <input
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("dob")}
          <input
            required
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("phone")} <span className="text-xs font-normal text-gray-400">({tCommon("optional")})</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("email")} <span className="text-xs font-normal text-gray-400">({tCommon("optional")})</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-[var(--color-blue)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            {t("create")}
          </button>
        </div>
      </form>
    </Modal>
    {duplicates && (
      <DuplicatePatientDialog
        duplicates={duplicates}
        canCreateAnyway
        submitting={submitting}
        onClose={() => setDuplicates(null)}
        onCreateAnyway={() => submit(true)}
      />
    )}
    </>
  );
}
