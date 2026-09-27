"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Practitioner } from "@prisma/client";
import { formatLongDate, toDateParam } from "@/lib/time";
import { BPE_CODES, BPE_SEXTANTS, type BpeSextantCode } from "@/lib/dental/chart-item-catalog";
import { useToast } from "@/components/ui/Toast";
import { createBpeExamAction } from "@/lib/actions/bpe-actions";
import type { BpeExamWithRelations } from "@/lib/services/bpe-service";

// Sextants laid out the way a clinician reads a BPE chart: upper row
// left-to-right, lower row left-to-right, matching the six-box paper form.
const GRID_LAYOUT: BpeSextantCode[] = ["UPPER_RIGHT", "UPPER_ANTERIOR", "UPPER_LEFT", "LOWER_RIGHT", "LOWER_ANTERIOR", "LOWER_LEFT"];

function NewBpeForm({
  patientId,
  practitioners,
  defaultPractitionerId,
  onCreated,
}: {
  patientId: string;
  practitioners: Practitioner[];
  defaultPractitionerId: string | null;
  onCreated: (exam: BpeExamWithRelations) => void;
}) {
  const t = useTranslations("dental");
  const tCommon = useTranslations("common");
  const toast = useToast();
  const [practitionerId, setPractitionerId] = useState(defaultPractitionerId ?? practitioners[0]?.id ?? "");
  const [examDate, setExamDate] = useState(toDateParam(new Date()));
  const [scores, setScores] = useState<Record<BpeSextantCode, string>>({
    UPPER_RIGHT: "0",
    UPPER_ANTERIOR: "0",
    UPPER_LEFT: "0",
    LOWER_RIGHT: "0",
    LOWER_ANTERIOR: "0",
    LOWER_LEFT: "0",
  });
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await createBpeExamAction({
      patientId,
      practitionerId: practitionerId || null,
      examDate: new Date(`${examDate}T00:00:00`),
      notes: notes || null,
      scores: BPE_SEXTANTS.map((sextant) => ({ sextant, code: scores[sextant] })),
    });
    setSubmitting(false);
    if (result.ok) {
      toast.show(tCommon("save"), { tone: "success" });
      onCreated(result.data as BpeExamWithRelations);
      setNotes("");
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-white p-4">
      <div className="grid grid-cols-3 gap-2" style={{ maxWidth: 320 }}>
        {GRID_LAYOUT.map((sextant) => (
          <label key={sextant} className="flex flex-col items-center gap-1 text-xs font-medium text-gray-600">
            {t(`bpeSextants.${sextant}`)}
            <select
              value={scores[sextant]}
              onChange={(e) => setScores((prev) => ({ ...prev, [sextant]: e.target.value }))}
              className="w-full rounded-md border border-[var(--color-border)] px-2 py-1.5 text-center text-sm"
            >
              {BPE_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("recordedDate")}
          <input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("practitioner")}
          <select
            value={practitionerId}
            onChange={(e) => setPractitionerId(e.target.value)}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {practitioners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        {t("note")}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
        />
      </label>
      <div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-[var(--color-blue)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
        >
          {t("saveBpe")}
        </button>
      </div>
    </form>
  );
}

export function BpeSection({
  patientId,
  exams: initialExams,
  practitioners,
  defaultPractitionerId,
  canManage,
}: {
  patientId: string;
  exams: BpeExamWithRelations[];
  practitioners: Practitioner[];
  defaultPractitionerId: string | null;
  canManage: boolean;
}) {
  const t = useTranslations("dental");
  const locale = useLocale();
  const [exams, setExams] = useState(initialExams);

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <NewBpeForm
          patientId={patientId}
          practitioners={practitioners}
          defaultPractitionerId={defaultPractitionerId}
          onCreated={(exam) => setExams((prev) => [exam, ...prev])}
        />
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t("bpeHistory")}</p>
        {exams.length === 0 ? (
          <p className="text-sm text-gray-400">{t("noBpe")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {exams.map((exam) => (
              <li key={exam.id} className="rounded-md border border-[var(--color-border)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[var(--color-text)]">{formatLongDate(exam.examDate, locale)}</span>
                  <span className="text-xs text-gray-500">{exam.practitioner?.name ?? "—"}</span>
                </div>
                <div className="mt-1.5 grid grid-cols-6 gap-1" style={{ maxWidth: 240 }}>
                  {GRID_LAYOUT.map((sextant) => {
                    const score = exam.scores.find((s) => s.sextant === sextant);
                    return (
                      <div key={sextant} className="flex flex-col items-center rounded border border-[var(--color-border)] py-1 text-xs">
                        <span className="font-semibold text-[var(--color-text)]">{score?.code ?? "—"}</span>
                      </div>
                    );
                  })}
                </div>
                {exam.notes && <p className="mt-1.5 text-xs text-gray-600">{exam.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
