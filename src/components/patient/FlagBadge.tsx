import { useTranslations } from "next-intl";
import type { PatientFlagKey } from "@/lib/patients/flag-catalog";

export function FlagBadge({ flagKey }: { flagKey: string }) {
  const t = useTranslations("flags.keys");
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-status-arrived-bg)] px-2 py-1 text-xs font-semibold text-[var(--color-status-arrived)]">
      {t(flagKey as PatientFlagKey)}
    </span>
  );
}
