import type { Currency, TreatmentItemStatus, TreatmentPlanStatus } from "@prisma/client";

// Pure money/plan arithmetic shared by the billing service, the UI and the
// unit tests. All USD amounts are integer cents; SYP amounts are whole pounds.

/** AURA policy: a deposit is never more than 5% of the treatment's total cost. */
export const MAX_DEPOSIT_PERCENT = 5;

/** AURA policy: refunds are processed within 3 working days (Friday is the weekly closing day). */
export const REFUND_WORKING_DAYS = 3;
export const CLOSED_WEEKDAYS = [5];

export const DEFAULT_STAGE_PERCENTS = [50, 30, 20] as const;

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

/** USD-cents equivalent of a payment, given its currency and (for SYP) SYP-per-USD rate. */
export function toUsdCents(amount: number, currency: Currency, exchangeRate?: number | null): number {
  if (currency === "USD") return amount;
  if (!exchangeRate || exchangeRate <= 0) throw new Error("An exchange rate is required for SYP payments.");
  return Math.round((amount / exchangeRate) * 100);
}

type ItemLike = { quantity: number; unitPriceCents: number; status: TreatmentItemStatus };

export function itemTotalCents(item: Pick<ItemLike, "quantity" | "unitPriceCents">): number {
  return item.quantity * item.unitPriceCents;
}

/** Sum of every item that hasn't been cancelled, before discount. */
export function planSubtotalCents(items: ItemLike[]): number {
  return items.filter((i) => i.status !== "CANCELLED").reduce((sum, i) => sum + itemTotalCents(i), 0);
}

export function planTotalCents(items: ItemLike[], discountCents: number): number {
  return Math.max(0, planSubtotalCents(items) - discountCents);
}

export function maxDepositCents(planTotal: number): number {
  return Math.floor((planTotal * MAX_DEPOSIT_PERCENT) / 100);
}

/** Plans in these states owe nothing (declined/cancelled) or are not yet agreed (draft/presented). */
export function planIsBillable(status: TreatmentPlanStatus): boolean {
  return status === "ACCEPTED" || status === "IN_PROGRESS" || status === "COMPLETED";
}

export type StageBreakdown = {
  stage: number;
  percent: number;
  dueCents: number;
  paidCents: number;
  remainingCents: number;
};

/**
 * Splits the plan total into its staged instalments (50/30/20 by default)
 * and allocates the net amount paid across them in order, so staff can see
 * exactly which stage is settled and what's due next. The last stage absorbs
 * rounding so the stages always sum to the total.
 */
export function stageBreakdown(totalCents: number, percents: number[], netPaidCents: number): StageBreakdown[] {
  let allocatedDue = 0;
  let remainingPaid = Math.max(0, netPaidCents);
  return percents.map((percent, index) => {
    const isLast = index === percents.length - 1;
    const dueCents = isLast ? totalCents - allocatedDue : Math.round((totalCents * percent) / 100);
    allocatedDue += dueCents;
    const paidCents = Math.min(dueCents, remainingPaid);
    remainingPaid -= paidCents;
    return { stage: index + 1, percent, dueCents, paidCents, remainingCents: dueCents - paidCents };
  });
}

export type PlanBalance = {
  totalCents: number;
  paidCents: number;
  refundedCents: number;
  netPaidCents: number;
  balanceCents: number;
};

export function planBalance(params: {
  items: ItemLike[];
  discountCents: number;
  status: TreatmentPlanStatus;
  payments: { amountUsdCents: number; voidedAt: Date | string | null }[];
  refunds: { amountUsdCents: number; status: string }[];
}): PlanBalance {
  const totalCents = planTotalCents(params.items, params.discountCents);
  const paidCents = params.payments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amountUsdCents, 0);
  const refundedCents = params.refunds.filter((r) => r.status === "PAID").reduce((s, r) => s + r.amountUsdCents, 0);
  const netPaidCents = paidCents - refundedCents;
  const owed = planIsBillable(params.status) ? totalCents : 0;
  return { totalCents, paidCents, refundedCents, netPaidCents, balanceCents: owed - netPaidCents };
}

/** Adds n working days (skipping the clinic's closing day) — used for refund due dates. */
export function addWorkingDays(from: Date, days: number, closedWeekdays: number[] = CLOSED_WEEKDAYS): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (!closedWeekdays.includes(d.getDay())) added++;
  }
  return d;
}

/**
 * Electronic and in-person requests share the 3-working-day ceiling; an
 * in-person refund paid on the spot is simply processed immediately.
 */
export function refundDueBy(requestedAt: Date): Date {
  return addWorkingDays(requestedAt, REFUND_WORKING_DAYS);
}

/**
 * "$1,250" in both languages: Latin digits and a leading "$" read the same
 * on Arabic and English screens (Intl's ar locale renders "US$" oddly).
 */
export function formatUsd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const n = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: abs % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(abs / 100);
  return `${sign}$${n}`;
}

export function formatAmount(amount: number, currency: Currency, locale: string): string {
  if (currency === "USD") return formatUsd(amount);
  const n = new Intl.NumberFormat("en-US").format(amount);
  return locale.startsWith("ar") ? `${n} ل.س` : `${n} SYP`;
}
