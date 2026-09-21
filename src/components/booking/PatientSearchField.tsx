"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Patient } from "@prisma/client";
import { searchPatientsAction } from "@/lib/actions/appointment-actions";

export function PatientSearchField({
  selectedPatient,
  onSelect,
  onRequestNewPatient,
}: {
  selectedPatient: Patient | null;
  onSelect: (patient: Patient) => void;
  onRequestNewPatient: (prefillQuery: string) => void;
}) {
  const t = useTranslations("patientSearch");
  const tBooking = useTranslations("booking");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 0) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const rows = await searchPatientsAction(query);
      setResults(rows);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  if (selectedPatient) {
    return (
      <div className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-gray-50 px-3 py-2">
        <div>
          <p className="text-sm font-medium text-[var(--color-text)]">
            {selectedPatient.firstName} {selectedPatient.lastName}
          </p>
          <p className="text-xs text-gray-500">
            {selectedPatient.patientCode} · {new Intl.DateTimeFormat(locale).format(selectedPatient.dateOfBirth)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null as unknown as Patient)}
          className="text-xs font-medium text-[var(--color-blue)]"
        >
          {tBooking("patient")} ×
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={t("placeholder")}
        className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
      />
      {open && query.trim().length > 0 && (
        <div
          data-testid="patient-search-results"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-[var(--color-border)] bg-white shadow-lg"
        >
          {results.length === 0 ? (
            <div className="p-3 text-sm text-gray-400">{t("noResults")}</div>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onSelect(p);
                  setOpen(false);
                  setQuery("");
                }}
                className="block w-full border-b border-gray-50 px-3 py-2 text-start text-sm last:border-0 hover:bg-gray-50"
              >
                <span className="font-medium text-[var(--color-text)]">
                  {p.firstName} {p.lastName}
                </span>
                <span className="ms-2 text-xs text-gray-500">
                  {p.patientCode} · {new Intl.DateTimeFormat(locale).format(p.dateOfBirth)}
                  {p.phone ? ` · ${p.phone}` : ""}
                </span>
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => onRequestNewPatient(query)}
            className="block w-full border-t border-[var(--color-border)] px-3 py-2 text-start text-sm font-semibold text-[var(--color-blue)] hover:bg-blue-50"
          >
            {tBooking("newPatient")}
          </button>
        </div>
      )}
    </div>
  );
}
