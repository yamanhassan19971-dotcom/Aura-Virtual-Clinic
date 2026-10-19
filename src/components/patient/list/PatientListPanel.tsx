"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Patient } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { calcAge } from "@/lib/time";
import { searchPatientsFullAction } from "@/lib/actions/patient-actions";
import { NewPatientModal } from "@/components/booking/NewPatientModal";
import { BELOW_SM, useMediaQuery } from "@/components/ui/useMediaQuery";

type PatientRow = Patient & { activeAlertCount: number };

export function PatientListPanel({
  initialResults,
  canCreate,
}: {
  initialResults: PatientRow[];
  canCreate: boolean;
}) {
  const t = useTranslations("patientList");
  const isPhone = useMediaQuery(BELOW_SM);
  const tPatient = useTranslations("patient");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [results, setResults] = useState(initialResults);
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const rows = await searchPatientsFullAction(query, { includeArchived: showArchived });
      setResults(rows);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, showArchived]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-[var(--color-text)]">{t("title")}</h1>
        {canCreate && (
          <button
            type="button"
            onClick={() => setNewPatientOpen(true)}
            className="rounded-md bg-[var(--color-blue)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-600"
          >
            {t("newPatient")}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full max-w-md rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          {t("showArchived")}
        </label>
      </div>

      {query.trim().length === 0 && <p className="text-xs text-gray-400">{t("startTyping")}</p>}

      {results.length === 0 ? (
        <p className="text-sm text-gray-400">{t("empty")}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-white">
          {!isPhone && (
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-2 text-start">{t("columns.name")}</th>
                  <th className="px-4 py-2 text-start">{t("columns.patientId")}</th>
                  <th className="px-4 py-2 text-start">{t("columns.age")}</th>
                  <th className="px-4 py-2 text-start">{t("columns.phone")}</th>
                  <th className="px-4 py-2 text-start">{t("columns.alerts")}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link href={`/patients/${p.id}/overview`} className="font-medium text-[var(--color-blue)] hover:underline">
                        {p.firstName} {p.lastName}
                      </Link>
                      {p.status !== "ACTIVE" && (
                        <span className="ms-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                          {tPatient(`status.${p.status}`)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{p.patientCode}</td>
                    <td className="px-4 py-2 text-gray-600">{calcAge(p.dateOfBirth)}</td>
                    <td className="px-4 py-2 text-gray-600">
                      <bdi dir="ltr">{p.phone ?? "—"}</bdi>
                    </td>
                    <td className="px-4 py-2">
                      {p.activeAlertCount > 0 && (
                        <span className="rounded-full bg-[var(--color-status-fta-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--color-status-fta)]">
                          {p.activeAlertCount}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {isPhone && (
            <ul className="divide-y divide-[var(--color-border)]">
              {results.map((p) => (
                <li key={p.id}>
                  <Link href={`/patients/${p.id}/overview`} className="flex items-center gap-3 px-4 py-3 active:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-[var(--color-blue)]">
                          {p.firstName} {p.lastName}
                        </span>
                        {p.status !== "ACTIVE" && (
                          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                            {tPatient(`status.${p.status}`)}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-gray-500">
                        <span>{p.patientCode}</span>
                        <span>{t("columns.age")} {calcAge(p.dateOfBirth)}</span>
                        {p.phone && <bdi dir="ltr">{p.phone}</bdi>}
                      </div>
                    </div>
                    {p.activeAlertCount > 0 && (
                      <span className="shrink-0 rounded-full bg-[var(--color-status-fta-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--color-status-fta)]">
                        {p.activeAlertCount}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {newPatientOpen && (
        <NewPatientModal
          prefillName={query}
          onClose={() => setNewPatientOpen(false)}
          onCreated={(patient) => {
            setResults((prev) => [{ ...patient, activeAlertCount: 0 }, ...prev]);
            setNewPatientOpen(false);
          }}
        />
      )}
    </div>
  );
}
