"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { CANCELLATION_REASONS } from "@/lib/validation/appointment";
import type { AppointmentWithRelations } from "@/lib/services/appointment-service";

export function CancelDialog({
  appointment,
  onClose,
  onConfirm,
  submitting,
}: {
  appointment: AppointmentWithRelations;
  onClose: () => void;
  onConfirm: (reason: string, notes: string) => void;
  submitting: boolean;
}) {
  const t = useTranslations("cancelDialog");
  const [reason, setReason] = useState<string>(CANCELLATION_REASONS[0]);
  const [notes, setNotes] = useState("");

  return (
    <Modal title={t("title")} onClose={onClose} width="sm">
      <p className="mb-3 text-sm text-gray-600">
        {t("confirmQuestion")} <strong>{appointment.patient.firstName} {appointment.patient.lastName}</strong>
      </p>
      <label className="mb-3 flex flex-col gap-1 text-sm font-medium text-gray-700">
        {t("reasonLabel")}
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
        >
          {CANCELLATION_REASONS.map((r) => (
            <option key={r} value={r}>
              {t(`reasons.${r}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="mb-4 flex flex-col gap-1 text-sm font-medium text-gray-700">
        {t("notes")}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
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
          onClick={() => onConfirm(reason, notes)}
          className="rounded-md bg-[var(--color-status-fta)] px-3.5 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
        >
          {t("confirmBtn")}
        </button>
      </div>
    </Modal>
  );
}
