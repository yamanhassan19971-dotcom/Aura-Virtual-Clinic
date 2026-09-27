"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ClinicalNote, Practitioner } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { createClinicalNoteAction } from "@/lib/actions/clinical-note-actions";

export function ToothNoteModal({
  patientId,
  toothNumber,
  practitioners,
  defaultPractitionerId,
  onClose,
  onCreated,
}: {
  patientId: string;
  toothNumber: string;
  practitioners: Practitioner[];
  defaultPractitionerId: string | null;
  onClose: () => void;
  onCreated: (note: ClinicalNote) => void;
}) {
  const t = useTranslations("dental");
  const tNotes = useTranslations("clinicalNotes");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [practitionerId, setPractitionerId] = useState(defaultPractitionerId ?? practitioners[0]?.id ?? "");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await createClinicalNoteAction({ patientId, practitionerId, content, toothNumber });
    setSubmitting(false);
    if (result.ok) {
      toast.show(tCommon("save"), { tone: "success" });
      onCreated(result.data as ClinicalNote);
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  return (
    <Modal title={t("addNoteForTooth", { tooth: toothNumber })} onClose={onClose} width="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {tNotes("practitioner")}
          <select
            value={practitionerId}
            onChange={(e) => setPractitionerId(e.target.value)}
            required
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
          {tNotes("content")}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={8}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            {tCommon("cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting || !content.trim() || !practitionerId}
            className="rounded-md bg-[var(--color-blue)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            {tNotes("save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
