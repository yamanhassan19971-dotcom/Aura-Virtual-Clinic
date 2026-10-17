import { useTranslations } from "next-intl";
import type { LeadStage } from "@prisma/client";

export const STAGE_TONE: Record<LeadStage, string> = {
  NEW: "bg-rose-50 text-rose-700 ring-rose-200",
  CALL_BOOKED: "bg-blue-50 text-blue-700 ring-blue-200",
  THINKING: "bg-amber-50 text-amber-800 ring-amber-200",
  CONSULT_BOOKED: "bg-teal-50 text-teal-700 ring-teal-200",
  ATTENDED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  LOST: "bg-gray-100 text-gray-600 ring-gray-200",
};

export function LeadStageBadge({ stage }: { stage: LeadStage }) {
  const t = useTranslations("pipeline.leads.stage");
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STAGE_TONE[stage]}`}>
      {t(stage)}
    </span>
  );
}
