"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";

const TABS = [
  "overview",
  "details",
  "medical",
  "appointments",
  "history",
  "notes",
  "documents",
  "tasks",
] as const;
const CLINICAL_TABS = new Set<(typeof TABS)[number]>(["medical", "history"]);
const FUTURE_TABS = ["chart", "treatmentPlans", "account"] as const;

export function PatientTabs({ patientId, canViewClinical }: { patientId: string; canViewClinical: boolean }) {
  const t = useTranslations("patient.tabs");
  const tCommon = useTranslations("patient");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnDate = searchParams.get("returnDate");
  const fromAppointment = searchParams.get("fromAppointment");
  const extraQuery =
    returnDate || fromAppointment
      ? `?${new URLSearchParams({
          ...(returnDate ? { returnDate } : {}),
          ...(fromAppointment ? { fromAppointment } : {}),
        }).toString()}`
      : "";
  const base = `/patients/${patientId}`;

  return (
    <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)] bg-white px-6">
      {TABS.map((tab) => {
        // Receptionist has full demographic/administrative access but no
        // clinical access — the Medical and Clinical History tabs are not
        // just hidden buttons within them, they're unreachable entirely.
        if (CLINICAL_TABS.has(tab) && !canViewClinical) {
          return (
            <span
              key={tab}
              title={tCommon("noClinicalAccess")}
              className="cursor-not-allowed border-b-2 border-transparent px-3 py-3 text-sm font-medium text-gray-300"
            >
              {t(tab)}
            </span>
          );
        }
        const active = pathname === `${base}/${tab}`;
        return (
          <Link
            key={tab}
            href={`${base}/${tab}${extraQuery}`}
            className={`border-b-2 px-3 py-3 text-sm font-medium ${
              active
                ? "border-[var(--color-blue)] text-[var(--color-blue)]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t(tab)}
          </Link>
        );
      })}
      {FUTURE_TABS.map((tab) => (
        <span
          key={tab}
          title={tCommon("comingSoonTab")}
          className="cursor-not-allowed border-b-2 border-transparent px-3 py-3 text-sm font-medium text-gray-300"
        >
          {t(tab)}
        </span>
      ))}
    </div>
  );
}
