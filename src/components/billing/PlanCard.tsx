"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { TreatmentCatalogItem, TreatmentPlanStatus } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { formatLongDate } from "@/lib/time";
import { dollarsToCents, formatUsd, suggestedDepositCents, planIsBillable, planSubtotalCents } from "@/lib/billing/money";
import type { PlanWithMoney } from "@/lib/services/billing-queries";
import type { PlanAction } from "@/lib/validation/billing";
import {
  addPlanItemAction,
  cancelPlanItemAction,
  changePlanStatusAction,
  completePlanItemAction,
  removePlanItemAction,
  updatePlanAction,
} from "@/lib/actions/billing-actions";
import { PlanStatusBadge } from "@/components/billing/PlanStatusBadge";
import { useBillingAction } from "@/components/billing/useBillingAction";

export type PlanPermissions = { canManage: boolean; canDecide: boolean; canTakePayment: boolean };

const EDITABLE: TreatmentPlanStatus[] = ["DRAFT", "PRESENTED"];
const ACTIVE: TreatmentPlanStatus[] = ["ACCEPTED", "IN_PROGRESS"];

// Which buttons each status offers, and which permission each needs.
const STATUS_ACTIONS: Record<TreatmentPlanStatus, PlanAction[]> = {
  DRAFT: ["present", "accept", "decline", "cancel"],
  PRESENTED: ["accept", "decline", "cancel"],
  ACCEPTED: ["complete", "cancel"],
  IN_PROGRESS: ["complete", "cancel"],
  COMPLETED: [],
  DECLINED: ["reopen"],
  CANCELLED: ["reopen"],
};

const inputClass = "rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-gray-600";

function AddItemForm({ planId, catalog }: { planId: string; catalog: TreatmentCatalogItem[] }) {
  const t = useTranslations("billing.plans");
  const locale = useLocale();
  const { run, pending } = useBillingAction();
  const [catalogItemId, setCatalogItemId] = useState("");
  const [description, setDescription] = useState("");
  const [teeth, setTeeth] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState("");

  const categories = [...new Set(catalog.map((c) => c.category))];

  function pickCatalog(id: string) {
    setCatalogItemId(id);
    const item = catalog.find((c) => c.id === id);
    if (item) {
      setDescription(locale === "ar" ? item.nameAr : item.nameEn);
      setUnitPrice(String(item.priceCents / 100));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const created = await run(() =>
      addPlanItemAction({
        planId,
        catalogItemId: catalogItemId || null,
        description,
        teeth: teeth || null,
        quantity,
        unitPriceCents: dollarsToCents(Number(unitPrice) || 0),
      })
    );
    if (created) {
      setCatalogItemId("");
      setDescription("");
      setTeeth("");
      setQuantity(1);
      setUnitPrice("");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-md bg-gray-50 p-3">
      <label className={`${labelClass} min-w-[200px] flex-1`}>
        {t("fromPriceList")}
        <select value={catalogItemId} onChange={(e) => pickCatalog(e.target.value)} className={inputClass}>
          <option value="">{t("custom")}</option>
          {categories.map((category) => (
            <optgroup key={category} label={category}>
              {catalog
                .filter((c) => c.category === category)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {locale === "ar" ? c.nameAr : c.nameEn} · {formatUsd(c.priceCents)}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className={`${labelClass} min-w-[180px] flex-1`}>
        {t("description")}
        <input required value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </label>
      <label className={`${labelClass} w-28`}>
        {t("teeth")}
        <input value={teeth} onChange={(e) => setTeeth(e.target.value)} placeholder={t("teethPlaceholder")} className={inputClass} />
      </label>
      <label className={`${labelClass} w-16`}>
        {t("quantity")}
        <input
          type="number"
          min={1}
          max={64}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          className={inputClass}
        />
      </label>
      <label className={`${labelClass} w-28`}>
        {t("unitPrice")}
        <input
          type="number"
          min={0}
          step="0.01"
          required
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          className={inputClass}
        />
      </label>
      <button
        type="submit"
        disabled={pending || !description.trim() || unitPrice === ""}
        className="rounded-md bg-[var(--color-blue)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
      >
        {t("addItem")}
      </button>
    </form>
  );
}

function MoneyEditor({ plan, onDone }: { plan: PlanWithMoney; onDone: () => void }) {
  const t = useTranslations("billing.plans");
  const tCommon = useTranslations("common");
  const { run, pending } = useBillingAction();
  const [discount, setDiscount] = useState(String(plan.discountCents / 100));
  const [stages, setStages] = useState([plan.stage1Percent, plan.stage2Percent, plan.stage3Percent]);
  const sum = stages[0] + stages[1] + stages[2];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(() =>
      updatePlanAction({
        planId: plan.id,
        discountCents: dollarsToCents(Number(discount) || 0),
        stagePercents: stages as [number, number, number],
      })
    );
    if (ok) onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3 rounded-md bg-gray-50 p-3">
      <label className={`${labelClass} w-32`}>
        {t("discount")}
        <input type="number" min={0} step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputClass} />
      </label>
      <fieldset className="flex items-end gap-1">
        <legend className="mb-1 text-xs font-medium text-gray-600">{t("stagePercents")}</legend>
        {stages.map((value, i) => (
          <input
            key={i}
            type="number"
            min={0}
            max={100}
            aria-label={t("stage", { n: i + 1 })}
            value={value}
            onChange={(e) => setStages((prev) => prev.map((p, j) => (j === i ? Number(e.target.value) || 0 : p)))}
            className={`${inputClass} w-16`}
          />
        ))}
        <span className={`px-1 text-xs ${sum === 100 ? "text-gray-400" : "font-semibold text-red-600"}`}>= {sum}%</span>
      </fieldset>
      <button type="button" onClick={onDone} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-gray-600 hover:bg-white">
        {tCommon("cancel")}
      </button>
      <button
        type="submit"
        disabled={pending || sum !== 100}
        className="rounded-md bg-[var(--color-blue)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
      >
        {t("saveMoney")}
      </button>
    </form>
  );
}

export function PlanCard({
  plan,
  patientId,
  catalog,
  permissions,
  defaultOpen,
}: {
  plan: PlanWithMoney;
  patientId: string;
  catalog: TreatmentCatalogItem[];
  permissions: PlanPermissions;
  defaultOpen: boolean;
}) {
  const t = useTranslations("billing.plans");
  const locale = useLocale();
  const { run, pending } = useBillingAction();
  const [open, setOpen] = useState(defaultOpen);
  const [editingMoney, setEditingMoney] = useState(false);

  const editable = EDITABLE.includes(plan.status);
  const active = ACTIVE.includes(plan.status);
  const billable = planIsBillable(plan.status);
  const subtotal = planSubtotalCents(plan.items);

  const actions = STATUS_ACTIONS[plan.status].filter((a) =>
    a === "accept" || a === "decline" ? permissions.canDecide : permissions.canManage
  );

  async function changeStatus(action: PlanAction) {
    // Declining or cancelling keeps a short reason on the plan for the
    // follow-up team ("price", "wants to think") — optional, never blocking.
    let reason: string | null = null;
    if (action === "decline" || action === "cancel") {
      reason = window.prompt(t("reasonPrompt")) ?? null;
    }
    await run(() => changePlanStatusAction({ planId: plan.id, action, reason }));
  }

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-white" data-testid={`plan-${plan.planNumber}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-start"
        aria-expanded={open}
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-gray-400">{plan.planNumber}</span>
          <span className="text-sm font-semibold text-[var(--color-text)]">{plan.title}</span>
          <PlanStatusBadge status={plan.status} />
          {plan.practitioner && <span className="text-xs text-gray-500">{plan.practitioner.name}</span>}
        </span>
        <span className="flex items-center gap-4 text-sm">
          <span>
            <span className="text-xs text-gray-400">{t("total")} </span>
            <span className="font-semibold">{formatUsd(plan.balance.totalCents)}</span>
          </span>
          {billable && (
            <span>
              <span className="text-xs text-gray-400">{t("balance")} </span>
              <span className={`font-semibold ${plan.balance.balanceCents > 0 ? "text-amber-700" : "text-green-700"}`}>
                {formatUsd(plan.balance.balanceCents)}
              </span>
            </span>
          )}
          <span className="text-gray-400">{open ? "▴" : "▾"}</span>
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-4 border-t border-[var(--color-border)] p-4">
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((action) => (
              <button
                key={action}
                type="button"
                disabled={pending}
                onClick={() => changeStatus(action)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
                  action === "accept" || action === "complete"
                    ? "bg-[var(--color-blue)] text-white hover:bg-blue-600"
                    : action === "decline" || action === "cancel"
                      ? "border border-red-200 text-red-700 hover:bg-red-50"
                      : "border border-[var(--color-border)] text-gray-700 hover:bg-gray-50"
                }`}
              >
                {t(`action.${action}`)}
              </button>
            ))}
            <span className="flex-1" />
            {permissions.canTakePayment && active && (
              <Link href={`/patients/${patientId}/account`} className="text-sm font-medium text-[var(--color-blue)] hover:underline">
                {t("openAccount")}
              </Link>
            )}
            <a
              href={`/${locale}/print/treatment-plan/${plan.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-[var(--color-blue)] hover:underline"
            >
              {t("print")}
            </a>
          </div>

          {plan.statusReason && (plan.status === "DECLINED" || plan.status === "CANCELLED") && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{plan.statusReason}</p>
          )}
          {plan.notes && <p className="whitespace-pre-wrap text-sm text-gray-600">{plan.notes}</p>}
          {!editable && active && <p className="text-xs text-gray-500">{t("lockedHint")}</p>}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <th className="px-2 py-2 text-start">{t("description")}</th>
                  <th className="px-2 py-2 text-start">{t("teeth")}</th>
                  <th className="px-2 py-2 text-end">{t("quantity")}</th>
                  <th className="px-2 py-2 text-end">{t("unitPrice")}</th>
                  <th className="px-2 py-2 text-end">{t("lineTotal")}</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {plan.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-3 text-gray-400">
                      {t("noItems")}
                    </td>
                  </tr>
                )}
                {plan.items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className={`px-2 py-2 ${item.status === "CANCELLED" ? "text-gray-400 line-through" : ""}`}>
                      {item.description}
                      {item.status === "COMPLETED" && (
                        <span className="ms-2 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">
                          {t("itemStatus.COMPLETED")}
                          {item.completedAt && ` · ${formatLongDate(item.completedAt, locale)}`}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-gray-600">{item.teeth}</td>
                    <td className="px-2 py-2 text-end">{item.quantity}</td>
                    <td className="px-2 py-2 text-end">{formatUsd(item.unitPriceCents)}</td>
                    <td className="px-2 py-2 text-end font-medium">{formatUsd(item.quantity * item.unitPriceCents)}</td>
                    <td className="px-2 py-2 text-end whitespace-nowrap">
                      {permissions.canManage && editable && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => removePlanItemAction({ itemId: item.id }))}
                          className="text-xs text-red-600 hover:underline"
                        >
                          {t("remove")}
                        </button>
                      )}
                      {permissions.canManage && active && item.status === "PLANNED" && (
                        <span className="inline-flex gap-2">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => run(() => completePlanItemAction({ itemId: item.id }))}
                            className="rounded bg-green-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-green-700"
                          >
                            {t("markDone")}
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => run(() => cancelPlanItemAction({ itemId: item.id }))}
                            className="text-xs text-gray-500 hover:underline"
                          >
                            {t("markCancelled")}
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {permissions.canManage && editable && <AddItemForm planId={plan.id} catalog={catalog} />}

          <div className="grid gap-4 md:grid-cols-2">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-gray-500">{t("subtotal")}</dt>
              <dd className="text-end">{formatUsd(subtotal)}</dd>
              {plan.discountCents > 0 && (
                <>
                  <dt className="text-gray-500">{t("discount")}</dt>
                  <dd className="text-end">−{formatUsd(plan.discountCents)}</dd>
                </>
              )}
              <dt className="font-semibold">{t("total")}</dt>
              <dd className="text-end font-semibold">{formatUsd(plan.balance.totalCents)}</dd>
              <dt className="text-gray-500">{t("suggestedDeposit")}</dt>
              <dd className="text-end text-gray-500">{formatUsd(suggestedDepositCents(plan.balance.totalCents))}</dd>
              {billable && (
                <>
                  <dt className="text-gray-500">{t("paid")}</dt>
                  <dd className="text-end">{formatUsd(plan.balance.paidCents)}</dd>
                  {plan.balance.refundedCents > 0 && (
                    <>
                      <dt className="text-gray-500">{t("refunded")}</dt>
                      <dd className="text-end">−{formatUsd(plan.balance.refundedCents)}</dd>
                    </>
                  )}
                  <dt className="font-semibold">{t("balance")}</dt>
                  <dd className="text-end font-semibold">{formatUsd(plan.balance.balanceCents)}</dd>
                </>
              )}
            </dl>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t("stages")}</h4>
                {permissions.canManage && editable && !editingMoney && (
                  <button type="button" onClick={() => setEditingMoney(true)} className="text-xs text-[var(--color-blue)] hover:underline">
                    {t("editMoney")}
                  </button>
                )}
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {plan.stages.map((stage) => (
                    <tr key={stage.stage} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-1.5">
                        {t("stage", { n: stage.stage })} <span className="text-xs text-gray-400">({stage.percent}%)</span>
                      </td>
                      <td className="py-1.5 text-end">{formatUsd(stage.dueCents)}</td>
                      {billable && (
                        <td
                          className={`py-1.5 text-end text-xs ${stage.remainingCents === 0 ? "text-green-700" : "text-amber-700"}`}
                        >
                          {stage.remainingCents === 0 ? "✓" : `${t("remaining")} ${formatUsd(stage.remainingCents)}`}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-xs text-gray-400">{t("stageHint")}</p>
            </div>
          </div>

          {editingMoney && <MoneyEditor plan={plan} onDone={() => setEditingMoney(false)} />}

          <p className="text-xs text-gray-400">
            {t("created")} {formatLongDate(plan.createdAt, locale)}
            {plan.createdBy && ` · ${plan.createdBy.name}`}
          </p>
        </div>
      )}
    </section>
  );
}
