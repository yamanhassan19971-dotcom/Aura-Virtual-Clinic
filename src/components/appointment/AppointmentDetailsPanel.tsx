"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppointmentStatus, AppointmentStatusHistory } from "@prisma/client";
import type { AppointmentWithRelations } from "@/lib/services/appointment-service";
import { decodeReason } from "@/lib/services/appointment-service";
import { formatTime, formatLongDate, toDateParam } from "@/lib/time";
import { StatusBadge } from "@/components/diary/StatusBadge";
import { Link } from "@/i18n/navigation";
import { getStatusHistoryAction } from "@/lib/actions/query-actions";

type HistoryRow = AppointmentStatusHistory & { changedBy: { name: string } | null };

const NEXT_STATUS: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  PENDING: ["CONFIRMED", "ARRIVED"],
  CONFIRMED: ["ARRIVED"],
  ARRIVED: ["IN_SURGERY"],
  IN_SURGERY: ["COMPLETED"],
};

// Keyed by the TARGET status a quick-action button transitions to (not the
// appointment's current status) — the button for reaching CONFIRMED reads
// "Confirm", the one reaching ARRIVED reads "Arrived", and so on.
const QUICK_ACTION_LABEL_KEY: Record<AppointmentStatus, string> = {
  PENDING: "markConfirmed",
  CONFIRMED: "markConfirmed",
  ARRIVED: "markArrived",
  IN_SURGERY: "markInSurgery",
  COMPLETED: "markCompleted",
  CANCELLED: "markCompleted",
  FTA: "markCompleted",
};

export function AppointmentDetailsPanel({
  appointment,
  canEdit,
  canCancel,
  canFta,
  onClose,
  onStatusChange,
  onOpenEdit,
  onOpenCancel,
  onOpenFta,
}: {
  appointment: AppointmentWithRelations;
  canEdit: boolean;
  canCancel: boolean;
  canFta: boolean;
  onClose: () => void;
  onStatusChange: (status: AppointmentStatus) => void;
  onOpenEdit: () => void;
  onOpenCancel: () => void;
  onOpenFta: () => void;
}) {
  const t = useTranslations("panel");
  const tCancel = useTranslations("cancelDialog.reasons");
  const tFta = useTranslations("ftaDialog.reasons");
  const locale = useLocale();
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setHistory(null);
    getStatusHistoryAction(appointment.id).then((rows) => setHistory(rows as HistoryRow[]));
  }, [appointment.id, appointment.status]);

  const nextStatuses = NEXT_STATUS[appointment.status] ?? [];
  const isTerminal = ["COMPLETED", "CANCELLED", "FTA"].includes(appointment.status);

  const cancelInfo = appointment.cancellationReason ? decodeReason(appointment.cancellationReason) : null;
  const ftaInfo = appointment.ftaReason ? decodeReason(appointment.ftaReason) : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between border-b border-[var(--color-border)] p-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            {appointment.patient.firstName} {appointment.patient.lastName}
          </h2>
          <p className="text-sm text-gray-500">{appointment.appointmentType.name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="rounded p-1 text-gray-400 hover:bg-gray-100"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <section className="mb-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
            {t("appointmentInfo")}
          </h3>
          <p className="text-sm text-[var(--color-text)]">{formatLongDate(appointment.startTime, locale)}</p>
          <p className="text-sm text-[var(--color-text)]">
            <bdi dir="ltr">
              {formatTime(appointment.startTime, locale)}–{formatTime(appointment.endTime, locale)}
            </bdi>{" "}
            ({appointment.durationMin} min)
          </p>
          <p className="text-sm text-gray-500">
            {appointment.practitioner.name} · {appointment.room.name}
          </p>
          <div className="mt-2">
            <StatusBadge status={appointment.status} />
          </div>
          {appointment.conflictOverride && (
            <p className="mt-2 text-xs font-medium text-[var(--color-status-arrived)]">
              ⚠ {t("conflictOverridden")}
            </p>
          )}
          {cancelInfo && (
            <p className="mt-2 text-xs text-gray-500">
              {tCancel(cancelInfo.code as never)}
              {cancelInfo.notes ? ` — ${cancelInfo.notes}` : ""}
            </p>
          )}
          {ftaInfo && (
            <p className="mt-2 text-xs text-gray-500">
              {tFta(ftaInfo.code as never)}
              {ftaInfo.notes ? ` — ${ftaInfo.notes}` : ""}
            </p>
          )}
        </section>

        <section className="mb-4">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t("patientInfo")}</h3>
            <Link
              href={`/patients/${appointment.patientId}/overview?fromAppointment=${appointment.id}&returnDate=${toDateParam(appointment.startTime)}`}
              className="text-xs font-medium text-[var(--color-blue)] hover:underline"
            >
              {t("openPatient")}
            </Link>
          </div>
          <p className="text-sm text-[var(--color-text)]">
            {appointment.patient.firstName} {appointment.patient.lastName} ({appointment.patient.patientCode})
          </p>
          <p className="text-sm text-gray-500">
            {new Intl.DateTimeFormat(locale).format(appointment.patient.dateOfBirth)}
          </p>
          {appointment.patient.phone && <p className="text-sm text-gray-500">{appointment.patient.phone}</p>}
        </section>

        {appointment.notes && (
          <section className="mb-4">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{t("notes")}</h3>
            <p className="text-sm text-[var(--color-text)]">{appointment.notes}</p>
          </section>
        )}

        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{t("statusHistory")}</h3>
          {!history ? (
            <p className="text-xs text-gray-400">…</p>
          ) : (
            <ol className="flex flex-col gap-1.5 border-s-2 border-[var(--color-border)] ps-3">
              {history.map((h) => (
                <li key={h.id} className="text-xs text-gray-500">
                  <span className="font-medium text-[var(--color-text)]">{formatTime(h.changedAt, locale)}</span>{" "}
                  — {h.newStatus} {h.changedBy && `· ${h.changedBy.name}`}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="border-t border-[var(--color-border)] p-4">
        {!isTerminal && (nextStatuses.length > 0 || canCancel || canFta) && (
          <>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t("quickActions")}</p>
            <div className="flex flex-wrap gap-2">
              {nextStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => onStatusChange(status)}
                  className="rounded-md bg-[var(--color-navy)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-navy-light)]"
                >
                  {t(QUICK_ACTION_LABEL_KEY[status])}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="relative mt-3">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="w-full rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            {t("moreActions")}
          </button>
          {moreOpen && (
            <div className="absolute bottom-full mb-1 w-full rounded-md border border-[var(--color-border)] bg-white p-1 shadow-lg">
              {canEdit && !isTerminal && (
                <MenuItem
                  label={t("edit")}
                  onClick={() => {
                    setMoreOpen(false);
                    onOpenEdit();
                  }}
                />
              )}
              {canCancel && !isTerminal && (
                <MenuItem
                  label={t("cancelAppt")}
                  onClick={() => {
                    setMoreOpen(false);
                    onOpenCancel();
                  }}
                />
              )}
              {canFta && !isTerminal && (
                <MenuItem
                  label={t("markFta")}
                  onClick={() => {
                    setMoreOpen(false);
                    onOpenFta();
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded px-3 py-1.5 text-start text-sm text-gray-700 hover:bg-gray-50"
    >
      {label}
    </button>
  );
}
