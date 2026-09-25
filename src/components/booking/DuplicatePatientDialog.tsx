"use client";

import { useLocale, useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { Link } from "@/i18n/navigation";
import type { DuplicatePatientInfo } from "@/lib/actions/action-result";

export function DuplicatePatientDialog({
  duplicates,
  canCreateAnyway,
  submitting,
  onClose,
  onCreateAnyway,
}: {
  duplicates: DuplicatePatientInfo[];
  canCreateAnyway: boolean;
  submitting: boolean;
  onClose: () => void;
  onCreateAnyway: () => void;
}) {
  const t = useTranslations("duplicateDialog");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  return (
    <Modal title={t("title")} onClose={onClose} width="sm">
      <p className="mb-3 text-sm text-gray-600">{t("question")}</p>
      <ul className="mb-4 flex flex-col gap-2">
        {duplicates.map((p) => (
          <li key={p.id} className="rounded-md border border-[var(--color-border)] bg-gray-50 px-3 py-2">
            <p className="text-sm font-medium text-[var(--color-text)]">
              {p.firstName} {p.lastName}
            </p>
            <p className="text-xs text-gray-500">
              {p.patientCode} · {new Intl.DateTimeFormat(locale).format(new Date(p.dateOfBirth))}
              {p.phone ? ` · ${p.phone}` : ""}
            </p>
            <Link
              href={`/patients/${p.id}/overview`}
              target="_blank"
              className="mt-1 inline-block text-xs font-medium text-[var(--color-blue)] hover:underline"
            >
              {t("openExisting")}
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-[var(--color-border)] px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          {tCommon("cancel")}
        </button>
        {canCreateAnyway && (
          <button
            type="button"
            disabled={submitting}
            onClick={onCreateAnyway}
            className="rounded-md bg-[var(--color-status-arrived)] px-3.5 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
          >
            {t("createAnyway")}
          </button>
        )}
      </div>
    </Modal>
  );
}
