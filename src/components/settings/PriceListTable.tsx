"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { TreatmentCatalogItem } from "@prisma/client";
import { createCatalogItemAction, updateCatalogItemAction } from "@/lib/actions/billing-actions";
import { dollarsToCents, formatUsd } from "@/lib/billing/money";
import { useToast } from "@/components/ui/Toast";

const inputClass = "rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm";

export function PriceListTable({ items: initial, canManage }: { items: TreatmentCatalogItem[]; canManage: boolean }) {
  const t = useTranslations("billing.priceList");
  const tSettings = useTranslations("settings");
  const tErrors = useTranslations("billing.errors");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ code: "", nameEn: "", nameAr: "", category: "", price: "", priceNote: "" });

  function showError(result: { message: string; code?: string }) {
    toast.show(result.code && tErrors.has(result.code) ? tErrors(result.code) : result.message, { tone: "error" });
  }

  async function update(item: TreatmentCatalogItem, patch: Partial<{ priceCents: number; priceNote: string | null; active: boolean }>) {
    const result = await updateCatalogItemAction({ catalogItemId: item.id, ...patch });
    if (result.ok) {
      setItems((prev) => prev.map((x) => (x.id === item.id ? result.data : x)));
      toast.show(tSettings("saved"), { tone: "success" });
    } else {
      showError(result);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const result = await createCatalogItemAction({
      code: form.code.toUpperCase(),
      nameEn: form.nameEn,
      nameAr: form.nameAr,
      category: form.category,
      priceCents: dollarsToCents(Number(form.price) || 0),
      priceNote: form.priceNote || null,
    });
    if (result.ok) {
      setItems((prev) => [...prev, result.data]);
      setForm({ code: "", nameEn: "", nameAr: "", category: form.category, price: "", priceNote: "" });
      setAdding(false);
    } else {
      showError(result);
    }
  }

  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <div className="flex max-w-5xl flex-col gap-3">
      <p className="text-sm text-gray-500">{t("hint")}</p>
      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-xs font-semibold uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3 text-start">{locale === "ar" ? t("nameAr") : t("nameEn")}</th>
              <th className="px-4 py-3 text-start">{t("price")}</th>
              <th className="px-4 py-3 text-start">{t("priceNote")}</th>
              <th className="px-4 py-3 text-start">{tSettings("active")}</th>
            </tr>
          </thead>
          {categories.map((category) => (
            <tbody key={category}>
              <tr className="bg-gray-50">
                <td colSpan={4} className="px-4 py-1.5 text-xs font-semibold text-gray-500">
                  {category}
                </td>
              </tr>
              {items
                .filter((i) => i.category === category)
                .map((item) => (
                  <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-4 py-2">
                      <span className={item.active ? "" : "text-gray-400"}>{locale === "ar" ? item.nameAr : item.nameEn}</span>
                      <span className="block font-mono text-xs text-gray-400">{item.code}</span>
                    </td>
                    <td className="px-4 py-2">
                      {canManage ? (
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          defaultValue={item.priceCents / 100}
                          aria-label={t("price")}
                          onBlur={(e) => {
                            const cents = dollarsToCents(Number(e.target.value) || 0);
                            if (cents !== item.priceCents) update(item, { priceCents: cents });
                          }}
                          className={`${inputClass} w-28`}
                        />
                      ) : (
                        formatUsd(item.priceCents, locale)
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {canManage ? (
                        <input
                          defaultValue={item.priceNote ?? ""}
                          aria-label={t("priceNote")}
                          onBlur={(e) => {
                            const note = e.target.value.trim() || null;
                            if (note !== item.priceNote) update(item, { priceNote: note });
                          }}
                          className={`${inputClass} w-full`}
                        />
                      ) : (
                        <span className="text-gray-500">{item.priceNote}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        disabled={!canManage}
                        onClick={() => update(item, { active: !item.active })}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          item.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {item.active ? tSettings("active") : tSettings("inactive")}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          ))}
        </table>

        {canManage && (
          <div className="border-t border-[var(--color-border)] p-4">
            {adding ? (
              <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
                {(
                  [
                    ["code", t("code"), "w-36"],
                    ["nameAr", t("nameAr"), "w-48"],
                    ["nameEn", t("nameEn"), "w-48"],
                    ["category", t("category"), "w-36"],
                    ["price", t("price"), "w-24"],
                    ["priceNote", t("priceNote"), "w-48"],
                  ] as const
                ).map(([key, label, width]) => (
                  <label key={key} className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                    {label}
                    <input
                      required={key !== "priceNote"}
                      type={key === "price" ? "number" : "text"}
                      min={key === "price" ? 0 : undefined}
                      step={key === "price" ? "0.01" : undefined}
                      list={key === "category" ? "price-list-categories" : undefined}
                      value={form[key]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className={`${inputClass} ${width}`}
                    />
                  </label>
                ))}
                <datalist id="price-list-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <button type="submit" className="rounded-md bg-[var(--color-blue)] px-3 py-1.5 text-sm font-semibold text-white">
                  {tCommon("save")}
                </button>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-gray-600"
                >
                  ×
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="rounded-md border border-dashed border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-gray-500 hover:border-[var(--color-blue)] hover:text-[var(--color-blue)]"
              >
                + {t("add")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
