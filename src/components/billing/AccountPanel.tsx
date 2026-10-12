"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Currency, PaymentKind, PaymentMethod, RefundChannel } from "@prisma/client";
import { formatLongDate } from "@/lib/time";
import { dollarsToCents, formatAmount, formatUsd, maxDepositCents, toUsdCents } from "@/lib/billing/money";
import type { getPatientAccount } from "@/lib/services/billing-queries";
import { processRefundAction, recordPaymentAction, requestRefundAction, voidPaymentAction } from "@/lib/actions/billing-actions";
import { Modal } from "@/components/ui/Modal";
import { useBillingAction } from "@/components/billing/useBillingAction";

type Account = Awaited<ReturnType<typeof getPatientAccount>>;
export type AccountPermissions = { canRecord: boolean; canVoid: boolean; canRequestRefund: boolean; canProcessRefund: boolean };

const METHODS: PaymentMethod[] = ["CASH", "SHAM_CASH", "BANK_TRANSFER", "OTHER"];
const inputClass = "rounded-md border border-[var(--color-border)] px-3 py-2 text-sm";
const labelClass = "flex flex-col gap-1 text-sm font-medium text-gray-700";
const primaryButton =
  "rounded-md bg-[var(--color-blue)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60";

// Only plans the patient has agreed to can take money (AURA deposit rule).
function payablePlans(account: Account) {
  return account.plans.filter((p) => p.status === "ACCEPTED" || p.status === "IN_PROGRESS" || p.status === "COMPLETED");
}

function RecordPaymentModal({ patientId, account, onClose }: { patientId: string; account: Account; onClose: () => void }) {
  const t = useTranslations("billing.account");
  const locale = useLocale();
  const { run, pending } = useBillingAction();
  const plans = payablePlans(account);
  const [planId, setPlanId] = useState(plans.find((p) => p.balance.balanceCents > 0)?.id ?? "");
  const [kind, setKind] = useState<PaymentKind>("PAYMENT");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("");
  const [note, setNote] = useState("");

  const plan = plans.find((p) => p.id === planId);
  const amountNumber = Number(amount) || 0;
  const minorAmount = currency === "USD" ? dollarsToCents(amountNumber) : Math.round(amountNumber);
  const rateNumber = Number(rate) || 0;
  const usdPreview = currency === "SYP" && rateNumber > 0 && minorAmount > 0 ? toUsdCents(minorAmount, "SYP", rateNumber) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(() =>
      recordPaymentAction({
        patientId,
        planId: planId || null,
        kind,
        method,
        currency,
        amount: minorAmount,
        exchangeRate: currency === "SYP" ? Math.round(rateNumber) : null,
        note: note || null,
      })
    );
    if (ok) onClose();
  }

  return (
    <Modal title={t("recordPayment")} onClose={onClose} width="lg">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className={labelClass}>
          {t("plan")}
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputClass}>
            <option value="">{t("noPlan")}</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.planNumber} · {p.title} · {formatUsd(p.balance.balanceCents, locale)}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            {t("kind")}
            <select value={kind} onChange={(e) => setKind(e.target.value as PaymentKind)} className={inputClass}>
              <option value="PAYMENT">{t("kindValue.PAYMENT")}</option>
              <option value="DEPOSIT" disabled={!planId}>
                {t("kindValue.DEPOSIT")}
              </option>
            </select>
          </label>
          <label className={labelClass}>
            {t("method")}
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={inputClass}>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {t(`methodValue.${m}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {kind === "DEPOSIT" && plan && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {t("depositHint", { max: formatUsd(maxDepositCents(plan.balance.totalCents) - plan.depositCents, locale) })}
          </p>
        )}
        <div className="grid grid-cols-3 gap-3">
          <label className={labelClass}>
            {t("currency")}
            <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className={inputClass}>
              <option value="USD">USD $</option>
              <option value="SYP">SYP ل.س</option>
            </select>
          </label>
          <label className={labelClass}>
            {t("amount")}
            <input
              type="number"
              min={0}
              step={currency === "USD" ? "0.01" : "1"}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
            />
          </label>
          {currency === "SYP" && (
            <label className={labelClass}>
              {t("exchangeRate")}
              <input type="number" min={1} required value={rate} onChange={(e) => setRate(e.target.value)} className={inputClass} />
            </label>
          )}
        </div>
        {usdPreview !== null && (
          <p className="text-xs text-gray-500">
            {t("usdEquivalent")}: <span className="font-semibold">{formatUsd(usdPreview, locale)}</span>
          </p>
        )}
        <label className={labelClass}>
          {t("note")}
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </label>
        <div className="flex justify-end">
          <button type="submit" disabled={pending || minorAmount <= 0 || (currency === "SYP" && rateNumber <= 0)} className={primaryButton}>
            {t("recordPayment")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RefundModal({ patientId, account, onClose }: { patientId: string; account: Account; onClose: () => void }) {
  const t = useTranslations("billing.account");
  const locale = useLocale();
  const { run, pending } = useBillingAction();
  const plansWithMoney = account.plans.filter((p) => p.balance.netPaidCents > 0);
  const [planId, setPlanId] = useState(plansWithMoney[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState<RefundChannel>("ELECTRONIC");
  const [reason, setReason] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(() =>
      requestRefundAction({
        patientId,
        planId: planId || null,
        amountUsdCents: dollarsToCents(Number(amount) || 0),
        channel,
        reason: reason || null,
      })
    );
    if (ok) onClose();
  }

  return (
    <Modal title={t("requestRefund")} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">{t("refundPolicy")}</p>
        <label className={labelClass}>
          {t("plan")}
          <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputClass}>
            <option value="">{t("noPlan")}</option>
            {plansWithMoney.map((p) => (
              <option key={p.id} value={p.id}>
                {p.planNumber} · {p.title} · {t("paid")} {formatUsd(p.balance.netPaidCents, locale)}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            {t("amount")} ($)
            <input type="number" min={0} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            {t("channel")}
            <select value={channel} onChange={(e) => setChannel(e.target.value as RefundChannel)} className={inputClass}>
              <option value="ELECTRONIC">{t("channelValue.ELECTRONIC")}</option>
              <option value="IN_PERSON">{t("channelValue.IN_PERSON")}</option>
            </select>
          </label>
        </div>
        <label className={labelClass}>
          {t("reason")}
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
        </label>
        <div className="flex justify-end">
          <button type="submit" disabled={pending || !(Number(amount) > 0)} className={primaryButton}>
            {t("requestRefund")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone?: "warn" | "good" }) {
  const toneClass = tone === "warn" ? "text-amber-700" : tone === "good" ? "text-green-700" : "text-[var(--color-text)]";
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-3">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

export function AccountPanel({
  patientId,
  account,
  permissions,
}: {
  patientId: string;
  account: Account;
  permissions: AccountPermissions;
}) {
  const t = useTranslations("billing.account");
  const locale = useLocale();
  const { run, pending } = useBillingAction();
  const [modal, setModal] = useState<"payment" | "refund" | null>(null);
  const { summary } = account;

  async function voidPayment(paymentId: string) {
    const reason = window.prompt(t("voidReason"));
    if (!reason?.trim()) return;
    await run(() => voidPaymentAction({ paymentId, reason }));
  }

  async function processRefund(refundId: string, outcome: "PAID" | "REJECTED") {
    let method: PaymentMethod | null = null;
    if (outcome === "PAID") {
      // A short numbered choice keeps this a one-tap action for the manager.
      const options = METHODS.map((m, i) => `${i + 1}. ${t(`methodValue.${m}`)}`).join("\n");
      const answer = window.prompt(`${t("method")}\n${options}`, "1");
      const index = Number(answer) - 1;
      if (!(index >= 0 && index < METHODS.length)) return;
      method = METHODS[index];
    }
    await run(() => processRefundAction({ refundId, outcome, method }));
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryTile label={t("billed")} value={formatUsd(summary.billedCents, locale)} />
        <SummaryTile label={t("paid")} value={formatUsd(summary.paidCents - summary.refundedCents, locale)} />
        <SummaryTile
          label={summary.balanceCents < 0 ? t("inCredit") : t("balance")}
          value={formatUsd(Math.abs(summary.balanceCents), locale)}
          tone={summary.balanceCents > 0 ? "warn" : "good"}
        />
        <SummaryTile label={t("pendingRefunds")} value={formatUsd(summary.pendingRefundCents, locale)} />
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{t("payments")}</h3>
          {permissions.canRecord && (
            <button type="button" onClick={() => setModal("payment")} className={primaryButton}>
              {t("recordPayment")}
            </button>
          )}
        </div>
        {account.payments.length === 0 ? (
          <p className="text-sm text-gray-400">{t("noPayments")}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-3 py-2 text-start">{t("receipt")}</th>
                  <th className="px-3 py-2 text-start">{t("date")}</th>
                  <th className="px-3 py-2 text-start">{t("plan")}</th>
                  <th className="px-3 py-2 text-start">{t("kind")}</th>
                  <th className="px-3 py-2 text-start">{t("method")}</th>
                  <th className="px-3 py-2 text-end">{t("amount")}</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {account.payments.map((p) => (
                  <tr key={p.id} className={`border-b border-[var(--color-border)] last:border-0 ${p.voidedAt ? "text-gray-400" : ""}`}>
                    <td className="px-3 py-2 font-mono text-xs">{p.receiptNumber}</td>
                    <td className="px-3 py-2">{formatLongDate(p.receivedAt, locale)}</td>
                    <td className="px-3 py-2 text-xs">{p.plan ? `${p.plan.planNumber} · ${p.plan.title}` : "—"}</td>
                    <td className="px-3 py-2">{t(`kindValue.${p.kind}`)}</td>
                    <td className="px-3 py-2">{t(`methodValue.${p.method}`)}</td>
                    <td className={`px-3 py-2 text-end ${p.voidedAt ? "line-through" : "font-medium"}`}>
                      {formatAmount(p.amount, p.currency, locale)}
                      {p.currency === "SYP" && <span className="block text-xs text-gray-400">{formatUsd(p.amountUsdCents, locale)}</span>}
                    </td>
                    <td className="px-3 py-2 text-end whitespace-nowrap text-xs">
                      {p.voidedAt ? (
                        <span title={p.voidReason ?? ""}>
                          {t("voided")}
                          {p.voidedBy && ` · ${p.voidedBy.name}`}
                        </span>
                      ) : (
                        <span className="inline-flex gap-3">
                          <a
                            href={`/${locale}/print/receipt/${p.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--color-blue)] hover:underline"
                          >
                            {t("printReceipt")}
                          </a>
                          {permissions.canVoid && (
                            <button type="button" disabled={pending} onClick={() => voidPayment(p.id)} className="text-red-600 hover:underline">
                              {t("void")}
                            </button>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">{t("refunds")}</h3>
          {permissions.canRequestRefund && summary.paidCents - summary.refundedCents > 0 && (
            <button
              type="button"
              onClick={() => setModal("refund")}
              className="rounded-md border border-[var(--color-border)] px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {t("requestRefund")}
            </button>
          )}
        </div>
        {account.refunds.length === 0 ? (
          <p className="text-sm text-gray-400">{t("noRefunds")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {account.refunds.map((r) => {
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-white p-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {formatUsd(r.amountUsdCents, locale)} · {t(`refundStatus.${r.status}`)}
                      {r.overdue && <span className="ms-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">{t("overdue")}</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t(`channelValue.${r.channel}`)} · {formatLongDate(r.requestedAt, locale)}
                      {r.status === "REQUESTED" && ` · ${t("dueBy")} ${formatLongDate(r.dueBy, locale)}`}
                      {r.plan && ` · ${r.plan.planNumber}`}
                      {r.reason && ` · ${r.reason}`}
                      {r.processedBy && ` · ${t("processedBy")} ${r.processedBy.name}`}
                      {r.method && ` (${t(`methodValue.${r.method}`)})`}
                    </p>
                  </div>
                  {permissions.canProcessRefund && r.status === "REQUESTED" && (
                    <span className="flex gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => processRefund(r.id, "PAID")}
                        className="rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700"
                      >
                        {t("markPaid")}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => processRefund(r.id, "REJECTED")}
                        className="rounded-md border border-[var(--color-border)] px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                      >
                        {t("reject")}
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {modal === "payment" && <RecordPaymentModal patientId={patientId} account={account} onClose={() => setModal(null)} />}
      {modal === "refund" && <RefundModal patientId={patientId} account={account} onClose={() => setModal(null)} />}
    </div>
  );
}
