"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { formatTime } from "@/lib/time";
import type { ConflictInfo } from "@/lib/actions/action-result";

export function ConflictDialog({
  conflict,
  canOverride,
  onClose,
  onOverride,
  submitting,
}: {
  conflict: ConflictInfo;
  canOverride: boolean;
  onClose: () => void;
  onOverride: (reason: string) => void;
  submitting: boolean;
}) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const [reason, setReason] = useState("");

  return (
    <Modal title={t("conflictTitle")} onClose={onClose} width="sm">
      <p className="mb-1 text-sm text-gray-600">
        {t("conflictBody", { practitioner: conflict.practitionerName })}
      </p>
      <p className="mb-3 rounded-md bg-gray-50 px-3 py-2 text-sm font-medium text-[var(--color-text)]">
        <bdi dir="ltr">
          {formatTime(new Date(conflict.startTime), locale)}–{formatTime(new Date(conflict.endTime), locale)}
        </bdi>{" "}
        · {conflict.patientName}
      </p>

      {canOverride ? (
        <>
          <p className="mb-2 text-sm font-medium text-[var(--color-status-arrived)]">⚠ {t("overrideWarning")}</p>
          <label className="mb-4 flex flex-col gap-1 text-sm font-medium text-gray-700">
            {t("overrideReason")}
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--color-border)] px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              {t("cancelBtn")}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => onOverride(reason)}
              className="rounded-md bg-[var(--color-status-arrived)] px-3.5 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
            >
              {t("continueAnyway")}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-500">{t("notPermittedOverride")}</p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-[var(--color-navy)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[var(--color-navy-light)]"
            >
              {t("cancelBtn")}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
