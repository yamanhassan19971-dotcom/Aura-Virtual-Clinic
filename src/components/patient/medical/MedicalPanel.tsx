"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { MedicalAlert, MedicalHistory, MedicalHistoryAnswer } from "@prisma/client";
import { formatLongDate } from "@/lib/time";
import { AlertBadge } from "@/components/patient/AlertBadge";
import { MedicalHistoryForm } from "@/components/patient/medical/MedicalHistoryForm";
import { MedicalAlertsManager } from "@/components/patient/medical/MedicalAlertsManager";
import { MEDICAL_QUESTION_BY_KEY, questionsByCategory } from "@/lib/medical/question-catalog";

const ANSWER_LABEL_KEY: Record<string, string> = {
  YES: "answerYes",
  NO: "answerNo",
  UNKNOWN: "answerUnknown",
  NOT_APPLICABLE: "answerNotApplicable",
};

type HistoryRow = MedicalHistory & { completedBy: { name: string } | null; answers: MedicalHistoryAnswer[] };

export function MedicalPanel({
  patientId,
  histories: initialHistories,
  alerts: initialAlerts,
  canManageHistory,
  canManageAlerts,
  startOpen,
}: {
  patientId: string;
  histories: HistoryRow[];
  alerts: MedicalAlert[];
  canManageHistory: boolean;
  canManageAlerts: boolean;
  startOpen: boolean;
}) {
  const t = useTranslations("medical");
  const tCategories = useTranslations("medical.categories");
  const tQuestions = useTranslations("medical.questions");
  const tAnswers = useTranslations("medical");
  const locale = useLocale();
  const router = useRouter();

  const [histories, setHistories] = useState(initialHistories);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [formOpen, setFormOpen] = useState(startOpen);
  const [expanded, setExpanded] = useState<string | null>(histories[0]?.id ?? null);

  // router.refresh() re-fetches server props but doesn't re-run useState's
  // initializer — sync explicitly so a freshly-raised alert actually shows.
  useEffect(() => {
    setAlerts(initialAlerts);
    setHistories(initialHistories);
  }, [initialAlerts, initialHistories]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{t("alerts")}</h3>
        </div>
        <MedicalAlertsManager
          patientId={patientId}
          alerts={alerts}
          onChange={setAlerts}
          canManage={canManageAlerts}
        />
      </section>

      <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{t("history")}</h3>
          {canManageHistory && (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="rounded-md bg-[var(--color-blue)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600"
            >
              {t("newHistory")}
            </button>
          )}
        </div>

        {histories.length === 0 ? (
          <p className="text-sm text-gray-400">{t("noHistory")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {histories.map((h) => {
              const isOpen = expanded === h.id;
              const flaggedAnswers = h.answers.filter((a) => {
                const def = MEDICAL_QUESTION_BY_KEY.get(a.questionKey);
                return def?.type === "YES_NO" ? a.answer === "YES" : def?.alertOnValues?.includes(a.freeText ?? "");
              });
              return (
                <li key={h.id} className="rounded-md border border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : h.id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-start"
                  >
                    <span>
                      <span className="text-sm font-medium text-[var(--color-text)]">
                        {formatLongDate(h.completedAt, locale)}
                      </span>
                      <span className="ms-2 text-xs text-gray-500">{t("completedBy", { name: h.completedBy?.name ?? "—" })}</span>
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        h.status === "CURRENT"
                          ? "bg-[var(--color-status-completed-bg)] text-[var(--color-status-completed)]"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {t(h.status === "CURRENT" ? "current" : "previous")}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-[var(--color-border)] p-3">
                      {flaggedAnswers.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {flaggedAnswers.map((a) => (
                            <AlertBadge
                              key={a.id}
                              size="sm"
                              label={a.freeText ? `${a.questionKey}::${a.freeText}` : a.questionKey}
                            />
                          ))}
                        </div>
                      )}
                      {h.notes && <p className="mb-3 text-sm text-gray-600">{h.notes}</p>}
                      {questionsByCategory().map(({ category, questions }) => {
                        const answered = questions
                          .map((q) => h.answers.find((a) => a.questionKey === q.key))
                          .filter((a): a is MedicalHistoryAnswer => Boolean(a) && (a!.answer !== null || Boolean(a!.freeText)));
                        if (answered.length === 0) return null;
                        return (
                          <div key={category} className="mb-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                              {tCategories(category)}
                            </p>
                            <ul className="ms-2 text-sm text-[var(--color-text)]">
                              {answered.map((a) => (
                                <li key={a.id}>
                                  {tQuestions(a.questionKey)}
                                  {a.answer && `: ${tAnswers(ANSWER_LABEL_KEY[a.answer] as never)}`}
                                  {a.freeText && ` — ${a.freeText}`}
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {formOpen && (
        <MedicalHistoryForm
          patientId={patientId}
          onClose={() => setFormOpen(false)}
          onSaved={(history) => {
            setHistories((prev) => [history, ...prev.map((h) => ({ ...h, status: "PREVIOUS" as const }))]);
            setExpanded(history.id);
            setFormOpen(false);
            router.refresh(); // picks up any medical alerts the submission just raised
          }}
        />
      )}
    </div>
  );
}
