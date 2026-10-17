"use client";

import { useTranslations } from "next-intl";
import type { TreatmentPlanStatus } from "@prisma/client";

const TONES: Record<TreatmentPlanStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  PRESENTED: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800",
  COMPLETED: "bg-green-100 text-green-800",
  DECLINED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-400",
};

export function PlanStatusBadge({ status }: { status: TreatmentPlanStatus }) {
  const t = useTranslations("billing.plans.status");
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[status]}`}>{t(status)}</span>;
}
