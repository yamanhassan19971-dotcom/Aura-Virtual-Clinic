"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { MedicalAlert } from "@prisma/client";
import { AlertBadge } from "@/components/patient/AlertBadge";
import { addMedicalAlertAction, resolveMedicalAlertAction } from "@/lib/actions/medical-actions";
import { useToast } from "@/components/ui/Toast";

export function MedicalAlertsManager({
  patientId,
  alerts,
  onChange,
  canManage,
}: {
  patientId: string;
  alerts: MedicalAlert[];
  onChange: (alerts: MedicalAlert[]) => void;
  canManage: boolean;
}) {
  const t = useTranslations("medical");
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const result = await addMedicalAlertAction({ patientId, label });
    setSubmitting(false);
    if (result.ok) {
      onChange([result.data, ...alerts]);
      setLabel("");
      setAdding(false);
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  async function handleResolve(alertId: string) {
    const result = await resolveMedicalAlertAction({ alertId });
    if (result.ok) {
      onChange(alerts.filter((a) => a.id !== alertId));
    } else {
      toast.show(result.message, { tone: "error" });
    }
  }

  return (
    <div>
      {alerts.length === 0 ? (
        <p className="text-sm text-gray-400">{t("noAlerts")}</p>
      ) : (
        <ul className="mb-3 flex flex-wrap gap-2">
          {alerts.map((a) => (
            <li key={a.id} className="flex items-center gap-1">
              <AlertBadge label={a.label} />
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleResolve(a.id)}
                  title={t("resolveAlert")}
                  className="text-xs text-gray-400 hover:text-[var(--color-status-fta)]"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage &&
        (adding ? (
          <form onSubmit={handleAdd} className="flex items-center gap-2">
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("alertLabel")}
              className="rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={!label.trim() || submitting}
              className="rounded-md bg-[var(--color-navy)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {t("addAlert")}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="text-sm text-gray-500">
              ×
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-md border border-dashed border-[var(--color-border)] px-3 py-1 text-xs font-medium text-gray-500 hover:border-[var(--color-blue)] hover:text-[var(--color-blue)]"
          >
            + {t("addAlert")}
          </button>
        ))}
    </div>
  );
}
