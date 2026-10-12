"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { TreatmentCatalogItem } from "@prisma/client";
import type { PlanWithMoney } from "@/lib/services/billing-queries";
import { createPlanAction } from "@/lib/actions/billing-actions";
import { PlanCard, type PlanPermissions } from "@/components/billing/PlanCard";
import { useBillingAction } from "@/components/billing/useBillingAction";

type PractitionerOption = { id: string; name: string };

function NewPlanForm({
  patientId,
  practitioners,
  defaultPractitionerId,
  onDone,
}: {
  patientId: string;
  practitioners: PractitionerOption[];
  defaultPractitionerId: string | null;
  onDone: () => void;
}) {
  const t = useTranslations("billing.plans");
  const tCommon = useTranslations("common");
  const { run, pending } = useBillingAction();
  const [title, setTitle] = useState("");
  const [practitionerId, setPractitionerId] = useState(defaultPractitionerId ?? "");
  const [notes, setNotes] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const created = await run(() =>
      createPlanAction({ patientId, title, practitionerId: practitionerId || null, notes: notes || null })
    );
    if (created) onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-white p-4">
      <div className="flex flex-wrap gap-3">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-sm font-medium text-gray-700">
          {t("planTitle")}
          <input
            autoFocus
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("titlePlaceholder")}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          {t("practitioner")}
          <select
            value={practitionerId}
            onChange={(e) => setPractitionerId(e.target.value)}
            className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {practitioners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
        {t("notes")}
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
        />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-md border border-[var(--color-border)] px-3.5 py-2 text-sm text-gray-600 hover:bg-gray-50">
          {tCommon("cancel")}
        </button>
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="rounded-md bg-[var(--color-blue)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
        >
          {t("create")}
        </button>
      </div>
    </form>
  );
}

export function TreatmentPlansPanel({
  patientId,
  plans,
  catalog,
  practitioners,
  defaultPractitionerId,
  permissions,
}: {
  patientId: string;
  plans: PlanWithMoney[];
  catalog: TreatmentCatalogItem[];
  practitioners: PractitionerOption[];
  defaultPractitionerId: string | null;
  permissions: PlanPermissions;
}) {
  const t = useTranslations("billing.plans");
  const [adding, setAdding] = useState(false);
  // Open plans start expanded; finished ones collapse to a summary line.
  const isOpenPlan = (p: PlanWithMoney) => !["COMPLETED", "DECLINED", "CANCELLED"].includes(p.status);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">{t("title")}</h3>
        {permissions.canManage && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-md bg-[var(--color-blue)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600"
          >
            {t("newPlan")}
          </button>
        )}
      </div>

      {adding && (
        <NewPlanForm
          patientId={patientId}
          practitioners={practitioners}
          defaultPractitionerId={defaultPractitionerId}
          onDone={() => setAdding(false)}
        />
      )}

      {plans.length === 0 && !adding ? (
        <p className="text-sm text-gray-400">{t("empty")}</p>
      ) : (
        plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            patientId={patientId}
            catalog={catalog}
            permissions={permissions}
            defaultOpen={isOpenPlan(plan)}
          />
        ))
      )}
    </div>
  );
}
