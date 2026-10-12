import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatLongDate } from "@/lib/time";
import { formatAmount, formatUsd } from "@/lib/billing/money";
import { getPaymentForReceipt } from "@/lib/services/billing-queries";
import { PrintButton } from "@/components/print/PrintButton";
import { PrintHeader } from "@/components/print/PrintHeader";

export default async function PrintReceiptPage({ params }: { params: Promise<{ locale: string; paymentId: string }> }) {
  const { locale, paymentId } = await params;
  const session = await auth();
  if (!session?.user || !can(session.user.role, "payments.view")) notFound();
  const payment = await getPaymentForReceipt(session.user.practiceId, paymentId);
  if (!payment || payment.voidedAt) notFound();
  const t = await getTranslations("billing");

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between border-b border-gray-200 py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[148mm] justify-end px-4 print:hidden">
        <PrintButton label={t("print.printNow")} />
      </div>
      <article className="mx-auto flex max-w-[148mm] flex-col gap-4 bg-white p-8 shadow print:p-0 print:shadow-none">
        <PrintHeader locale={locale} title={t("print.receiptTitle")} number={payment.receiptNumber} />
        <div>
          {row(t("print.date"), formatLongDate(payment.receivedAt, locale))}
          {row(t("print.receivedFrom"), `${payment.patient.firstName} ${payment.patient.lastName} (${payment.patient.patientCode})`)}
          {payment.plan && row(t("print.forPlan"), `${payment.plan.planNumber} · ${payment.plan.title}`)}
          {row(t("account.kind"), t(`account.kindValue.${payment.kind}`))}
          {row(t("account.method"), t(`account.methodValue.${payment.method}`))}
          {payment.currency === "SYP" && row(t("account.exchangeRate"), payment.exchangeRate?.toLocaleString("en-US"))}
          {payment.receivedBy && row(t("account.receivedBy"), payment.receivedBy.name)}
        </div>
        <div className="rounded-md bg-gray-50 p-4 text-center">
          <p className="text-xs text-gray-500">{t("account.amount")}</p>
          <p className="text-2xl font-bold text-[var(--color-navy)]">{formatAmount(payment.amount, payment.currency, locale)}</p>
          {payment.currency === "SYP" && <p className="text-sm text-gray-500">{formatUsd(payment.amountUsdCents)}</p>}
        </div>
        {payment.note && <p className="text-sm text-gray-600">{payment.note}</p>}
        <p className="mt-6 text-center text-sm text-gray-500">{t("print.thankYou")}</p>
      </article>
    </div>
  );
}
