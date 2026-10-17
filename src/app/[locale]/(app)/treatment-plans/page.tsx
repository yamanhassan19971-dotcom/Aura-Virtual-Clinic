import { getLocale, getTranslations } from "next-intl/server";
import type { TreatmentPlanStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { formatLongDate } from "@/lib/time";
import { formatUsd, planIsBillable } from "@/lib/billing/money";
import { countPlansByStatus, listPlans } from "@/lib/services/billing-queries";
import { PlanStatusBadge } from "@/components/billing/PlanStatusBadge";

const FILTERS: TreatmentPlanStatus[] = ["PRESENTED", "ACCEPTED", "IN_PROGRESS", "DRAFT", "COMPLETED", "DECLINED", "CANCELLED"];

// Practice-wide plan list. Defaults to PRESENTED: plans the doctor has shown
// the patient that are still waiting on a yes/no, i.e. the follow-up calls.
export default async function TreatmentPlansPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: statusParam } = await searchParams;
  const session = await auth();
  const practiceId = session!.user.practiceId;
  const t = await getTranslations("billing.plans");
  const locale = await getLocale();

  const status =
    statusParam === "ALL" ? undefined : FILTERS.includes(statusParam as TreatmentPlanStatus) ? (statusParam as TreatmentPlanStatus) : "PRESENTED";
  const [plans, counts] = await Promise.all([listPlans(practiceId, { status }), countPlansByStatus(practiceId)]);
  const total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);

  const chip = (value: string, label: string, count: number, active: boolean) => (
    <Link
      key={value}
      href={`/treatment-plans?status=${value}`}
      className={`rounded-full border px-3 py-1 text-sm ${
        active
          ? "border-[var(--color-blue)] bg-[var(--color-blue)] text-white"
          : "border-[var(--color-border)] bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label} <span className={active ? "text-white/80" : "text-gray-400"}>{count}</span>
    </Link>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--color-border)] bg-white px-6 py-4">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">{t("title")}</h1>
      </div>
      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => chip(f, t(`status.${f}`), counts[f] ?? 0, status === f))}
          {chip("ALL", t("allStatuses"), total, status === undefined)}
        </div>
        {status === "PRESENTED" && <p className="text-sm text-gray-500">{t("awaitingHint")}</p>}

        {plans.length === 0 ? (
          <p className="text-sm text-gray-400">{t("listEmpty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3 text-start">{t("patient")}</th>
                  <th className="px-4 py-3 text-start">{t("planTitle")}</th>
                  <th className="px-4 py-3 text-start">{t("practitioner")}</th>
                  <th className="px-4 py-3 text-start">{t("updated")}</th>
                  <th className="px-4 py-3 text-end">{t("total")}</th>
                  <th className="px-4 py-3 text-end">{t("balance")}</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/patients/${plan.patient.id}/treatment-plans`} className="font-medium text-[var(--color-blue)] hover:underline">
                        {plan.patient.firstName} {plan.patient.lastName}
                      </Link>
                      <span className="block text-xs text-gray-400" dir="ltr">
                        {plan.patient.patientCode}
                        {plan.patient.phone && ` · ${plan.patient.phone}`}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="me-2">{plan.title}</span>
                      <PlanStatusBadge status={plan.status} />
                      {plan.statusReason && <span className="block text-xs text-gray-400">{plan.statusReason}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{plan.practitioner?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-gray-600">{formatLongDate(plan.updatedAt, locale)}</td>
                    <td className="px-4 py-2.5 text-end font-medium">{formatUsd(plan.balance.totalCents)}</td>
                    <td className="px-4 py-2.5 text-end">
                      {planIsBillable(plan.status) ? formatUsd(plan.balance.balanceCents) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
