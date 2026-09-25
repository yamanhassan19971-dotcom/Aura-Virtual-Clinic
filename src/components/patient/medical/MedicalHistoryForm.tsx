"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { MedicalHistory, MedicalHistoryAnswer } from "@prisma/client";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { submitMedicalHistoryAction } from "@/lib/actions/medical-actions";
import { questionsByCategory, type MedicalQuestionDef } from "@/lib/medical/question-catalog";

type AnswerState = { answer?: string; freeText?: string };

function QuestionField({
  def,
  value,
  onChange,
}: {
  def: MedicalQuestionDef;
  value: AnswerState;
  onChange: (v: AnswerState) => void;
}) {
  const t = useTranslations("medical");
  const tQuestions = useTranslations("medical.questions");
  const tSmoking = useTranslations("medical.smokingOptions");

  if (def.type === "FREE_TEXT") {
    return (
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">{tQuestions(def.key)}</span>
        <input
          value={value.freeText ?? ""}
          onChange={(e) => onChange({ ...value, freeText: e.target.value })}
          className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
        />
      </label>
    );
  }

  if (def.type === "SELECT") {
    return (
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">{tQuestions(def.key)}</span>
        <select
          value={value.freeText ?? ""}
          onChange={(e) => onChange({ ...value, freeText: e.target.value })}
          className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
        >
          <option value="" />
          {def.options?.map((opt) => (
            <option key={opt} value={opt}>
              {tSmoking(opt as never)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const ANSWER_OPTIONS = [
    { code: "YES", label: t("answerYes") },
    { code: "NO", label: t("answerNo") },
    { code: "UNKNOWN", label: t("answerUnknown") },
    { code: "NOT_APPLICABLE", label: t("answerNotApplicable") },
  ];

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-gray-700">{tQuestions(def.key)}</span>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border border-[var(--color-border)]">
          {ANSWER_OPTIONS.map((opt) => (
            <button
              key={opt.code}
              type="button"
              onClick={() => onChange({ ...value, answer: opt.code })}
              className={`px-2.5 py-1 text-xs font-medium ${
                value.answer === opt.code ? "bg-[var(--color-navy)] text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {value.answer === "YES" && (
          <input
            value={value.freeText ?? ""}
            onChange={(e) => onChange({ ...value, freeText: e.target.value })}
            placeholder={t("detailPlaceholder")}
            className="flex-1 rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs"
          />
        )}
      </div>
    </div>
  );
}

export function MedicalHistoryForm({
  patientId,
  onClose,
  onSaved,
}: {
  patientId: string;
  onClose: () => void;
  onSaved: (history: MedicalHistory & { completedBy: { name: string } | null; answers: MedicalHistoryAnswer[] }) => void;
}) {
  const t = useTranslations("medical");
  const tCategories = useTranslations("medical.categories");
  const tCommon = useTranslations("common");
  const toast = useToast();

  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payloadAnswers = Object.entries(answers)
      .filter(([, v]) => v.answer || (v.freeText && v.freeText.trim().length > 0))
      .map(([questionKey, v]) => ({ questionKey, answer: v.answer as never, freeText: v.freeText ?? null }));

    const result = await submitMedicalHistoryAction({ patientId, notes: notes || null, answers: payloadAnswers });
    setSubmitting(false);
    if (result.ok) {
      toast.show(tCommon("save"), { tone: "success" });
      onSaved(result.data as never);
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  return (
    <Modal title={t("newHistory")} onClose={onClose} width="lg">
      <form onSubmit={handleSubmit} className="flex max-h-[70vh] flex-col gap-4 overflow-auto pe-1">
        {questionsByCategory().map(({ category, questions }) => (
          <fieldset key={category} className="rounded-md border border-[var(--color-border)] p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {tCategories(category)}
            </legend>
            <div className="flex flex-col gap-3">
              {questions.map((def) => (
                <QuestionField
                  key={def.key}
                  def={def}
                  value={answers[def.key] ?? {}}
                  onChange={(v) => setAnswers((prev) => ({ ...prev, [def.key]: v }))}
                />
              ))}
            </div>
          </fieldset>
        ))}

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("generalNotes")}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          />
        </label>

        <div className="sticky bottom-0 flex justify-end gap-2 bg-white pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            {tCommon("cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-[var(--color-blue)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            {t("submit")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
