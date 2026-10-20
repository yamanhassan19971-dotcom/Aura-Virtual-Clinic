"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";

const TABS = [
  "overview",
  "details",
  "chart",
  "treatmentPlans",
  "medical",
  "appointments",
  "account",
  "history",
  "images",
  "notes",
  "documents",
  "tasks",
] as const;
const CLINICAL_TABS = new Set<(typeof TABS)[number]>(["chart", "medical", "history", "images"]);
// Tab key -> URL segment, where they differ.
const TAB_SLUGS: Partial<Record<(typeof TABS)[number], string>> = { treatmentPlans: "treatment-plans" };

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
    <div className="no-scrollbar flex gap-1 overflow-x-auto whitespace-nowrap border-b border-[var(--color-border)] bg-white px-2 md:px-6">
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
        const slug = TAB_SLUGS[tab] ?? tab;
        const active = pathname === `${base}/${slug}`;
        return (
          <Link
            key={tab}
            href={`${base}/${slug}${extraQuery}`}
            ref={active ? (el) => el?.scrollIntoView({ block: "nearest", inline: "nearest" }) : undefined}
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
    </div>
  );
}
