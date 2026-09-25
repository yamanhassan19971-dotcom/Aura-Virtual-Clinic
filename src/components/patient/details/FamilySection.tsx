"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Patient } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { PatientSearchField } from "@/components/booking/PatientSearchField";
import { linkFamilyMemberAction, unlinkFamilyMemberAction } from "@/lib/actions/patient-actions";

export type FamilyEntry = {
  relationshipId: string;
  relationType: string;
  patient: { id: string; firstName: string; lastName: string; patientCode: string };
};

const RELATION_TYPES = ["SPOUSE", "PARENT", "CHILD", "SIBLING", "GUARDIAN", "OTHER"];

export function FamilySection({
  patientId,
  family: initialFamily,
  canManage,
}: {
  patientId: string;
  family: FamilyEntry[];
  canManage: boolean;
}) {
  const t = useTranslations("patientDetails");
  const tRelation = useTranslations("patientDetails.relationTypes");
  const tCommon = useTranslations("common");
  const toast = useToast();

  const [family, setFamily] = useState(initialFamily);
  const [linkOpen, setLinkOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [relationType, setRelationType] = useState("SPOUSE");
  const [submitting, setSubmitting] = useState(false);

  async function handleLink() {
    if (!selectedPatient) return;
    setSubmitting(true);
    const result = await linkFamilyMemberAction({
      patientId,
      relatedPatientId: selectedPatient.id,
      relationType,
    });
    setSubmitting(false);
    if (result.ok) {
      setFamily((prev) => [
        ...prev,
        {
          relationshipId: result.data.id,
          relationType,
          patient: {
            id: selectedPatient.id,
            firstName: selectedPatient.firstName,
            lastName: selectedPatient.lastName,
            patientCode: selectedPatient.patientCode,
          },
        },
      ]);
      setLinkOpen(false);
      setSelectedPatient(null);
      toast.show(tCommon("save"), { tone: "success" });
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  async function handleUnlink(relationshipId: string) {
    const result = await unlinkFamilyMemberAction({ relationshipId });
    if (result.ok) {
      setFamily((prev) => prev.filter((f) => f.relationshipId !== relationshipId));
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">{t("family")}</h3>
        {canManage && (
          <button
            type="button"
            onClick={() => setLinkOpen(true)}
            className="rounded-md border border-dashed border-[var(--color-border)] px-3 py-1 text-xs font-medium text-gray-500 hover:border-[var(--color-blue)] hover:text-[var(--color-blue)]"
          >
            + {t("linkFamilyMember")}
          </button>
        )}
      </div>

      {family.length === 0 ? (
        <p className="text-sm text-gray-400">{t("noFamily")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {family.map((entry) => (
            <li
              key={entry.relationshipId}
              className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-3 py-2"
            >
              <Link href={`/patients/${entry.patient.id}/overview`} className="text-sm hover:underline">
                <span className="font-medium text-[var(--color-text)]">
                  {entry.patient.firstName} {entry.patient.lastName}
                </span>
                <span className="ms-2 text-gray-500">— {tRelation(entry.relationType as never)}</span>
              </Link>
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleUnlink(entry.relationshipId)}
                  className="text-xs font-medium text-gray-400 hover:text-[var(--color-status-fta)]"
                >
                  {t("unlink")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {linkOpen && (
        <Modal title={t("linkFamilyMember")} onClose={() => setLinkOpen(false)} width="sm">
          <div className="flex flex-col gap-3">
            <div>
              <span className="mb-1 block text-sm font-medium text-gray-700">{t("selectRelatedPatient")}</span>
              <PatientSearchField selectedPatient={selectedPatient} onSelect={setSelectedPatient} onRequestNewPatient={() => {}} />
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              {t("selectRelationType")}
              <select
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
                className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
              >
                {RELATION_TYPES.map((r) => (
                  <option key={r} value={r}>
                    {tRelation(r as never)}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLinkOpen(false)}
                className="rounded-md border border-[var(--color-border)] px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                {tCommon("cancel")}
              </button>
              <button
                type="button"
                disabled={!selectedPatient || submitting}
                onClick={handleLink}
                className="rounded-md bg-[var(--color-blue)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
              >
                {tCommon("save")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
