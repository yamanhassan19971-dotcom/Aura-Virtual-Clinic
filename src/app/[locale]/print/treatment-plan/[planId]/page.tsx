import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatLongDate } from "@/lib/time";
import { formatUsd, planSubtotalCents } from "@/lib/billing/money";
import { getPlanForPrint } from "@/lib/services/billing-queries";
import { PrintButton } from "@/components/print/PrintButton";
import { PrintHeader } from "@/components/print/PrintHeader";

// The written plan the doctor hands the patient at consultation (Phase 3
// patient-journey script): treatments, prices, staged payments, signatures.
export default async function PrintTreatmentPlanPage({ params }: { params: Promise<{ locale: string; planId: string }> }) {
  const { locale, planId } = await params;
  const session = await auth();
  if (!session?.user || !can(session.user.role, "treatmentPlans.view")) notFound();
  const data = await getPlanForPrint(session.user.practiceId, planId);
  if (!data) notFound();
  const { plan, patient } = data;
  const t = await getTranslations("billing");
  const items = plan.items.filter((i) => i.status !== "CANCELLED");

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end px-4 print:hidden">
        <PrintButton label={t("print.printNow")} />
      </div>
      <article className="mx-auto flex max-w-[210mm] flex-col gap-6 bg-white p-10 shadow print:p-0 print:shadow-none">
        <PrintHeader locale={locale} title={t("print.planTitle")} number={plan.planNumber} />

        <section className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p>
            <span className="text-gray-500">{t("print.patient")}: </span>
            <span className="font-semibold">
              {patient.firstName} {patient.lastName}
            </span>
          </p>
          <p>
            <span className="text-gray-500">{t("print.fileNo")}: </span>
            {patient.patientCode}
          </p>
          <p>
            <span className="text-gray-500">{t("print.doctor")}: </span>
            {plan.practitioner?.name ?? "—"}
          </p>
          <p>
            <span className="text-gray-500">{t("print.date")}: </span>
            {formatLongDate(plan.presentedAt ?? plan.createdAt, locale)}
          </p>
        </section>

        <h2 className="text-lg font-semibold">{plan.title}</h2>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-300 text-xs font-semibold text-gray-500">
              <th className="py-2 text-start">{t("plans.description")}</th>
              <th className="py-2 text-start">{t("plans.teeth")}</th>
              <th className="py-2 text-end">{t("plans.quantity")}</th>
              <th className="py-2 text-end">{t("plans.unitPrice")}</th>
              <th className="py-2 text-end">{t("plans.lineTotal")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-200">
                <td className="py-2">{item.description}</td>
                <td className="py-2">{item.teeth}</td>
                <td className="py-2 text-end">{item.quantity}</td>
                <td className="py-2 text-end">{formatUsd(item.unitPriceCents)}</td>
                <td className="py-2 text-end">{formatUsd(item.quantity * item.unitPriceCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-sm">
            {plan.discountCents > 0 && (
              <>
                <tr>
                  <td colSpan={4} className="pt-3 text-end text-gray-500">
                    {t("plans.subtotal")}
                  </td>
                  <td className="pt-3 text-end">{formatUsd(planSubtotalCents(plan.items))}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="text-end text-gray-500">
                    {t("plans.discount")}
                  </td>
                  <td className="text-end">−{formatUsd(plan.discountCents)}</td>
                </tr>
              </>
            )}
            <tr>
              <td colSpan={4} className="pt-2 text-end font-bold">
                {t("plans.total")}
              </td>
              <td className="pt-2 text-end text-base font-bold">{formatUsd(plan.balance.totalCents)}</td>
            </tr>
          </tfoot>
        </table>

        <section>
          <h3 className="mb-2 text-sm font-semibold">{t("plans.stages")}</h3>
          <div className="grid grid-cols-3 gap-3">
            {plan.stages.map((s) => (
              <div key={s.stage} className="rounded-md border border-gray-200 p-3 text-center">
                <p className="text-xs text-gray-500">
                  {t("plans.stage", { n: s.stage })} · {s.percent}%
                </p>
                <p className="text-base font-semibold">{formatUsd(s.dueCents)}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {t("print.validity", { s1: plan.stage1Percent, s2: plan.stage2Percent, s3: plan.stage3Percent })}
          </p>
        </section>

        {plan.notes && <p className="whitespace-pre-wrap text-sm text-gray-700">{plan.notes}</p>}

        <footer className="mt-10 grid grid-cols-2 gap-10 text-sm">
          <div className="border-t border-gray-400 pt-2 text-center text-gray-500">{t("print.signaturePatient")}</div>
          <div className="border-t border-gray-400 pt-2 text-center text-gray-500">{t("print.signatureClinic")}</div>
        </footer>
      </article>
    </div>
  );
}
