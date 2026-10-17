"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { LeadInterest, LeadSource } from "@prisma/client";
import { LEAD_INTERESTS, LEAD_SOURCES } from "@/lib/validation/pipeline";
import { createLeadAction } from "@/lib/actions/pipeline-actions";
import { Modal } from "@/components/ui/Modal";
import { inputClass, labelClass, primaryButton, toLocalInput, usePipelineAction } from "@/components/pipeline/usePipelineAction";

/** The WhatsApp agent's form: the handoff card, filled while chatting. */
export function NewLeadModal({ onClose, nowIso }: { onClose: () => void; nowIso: string }) {
  const t = useTranslations("pipeline.leads");
  const router = useRouter();
  const { run, pending } = usePipelineAction();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    source: "FACEBOOK_AD" as LeadSource,
    sourceNote: "",
    interest: "IMPLANTS" as LeadInterest,
    forWhom: "",
    location: "",
    keyWords: "",
    toldSoFar: "",
    firstMessageAt: toLocalInput(new Date(nowIso)),
    replied: true,
    callAt: "",
  });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const lead = await run(() =>
      createLeadAction({
        ...form,
        firstMessageAt: new Date(form.firstMessageAt).toISOString(),
        callAt: form.callAt ? new Date(form.callAt).toISOString() : null,
      })
    );
    if (lead) {
      onClose();
      router.push(`/leads/${lead.id}`);
    }
  }

  return (
    <Modal title={t("new")} onClose={onClose} width="lg">
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          {t("fields.name")}
          <input required value={form.name} onChange={set("name")} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t("fields.phone")}
          <input required dir="ltr" inputMode="tel" value={form.phone} onChange={set("phone")} className={inputClass} placeholder="09xx xxx xxx" />
        </label>
        <label className={labelClass}>
          {t("fields.interest")}
          <select value={form.interest} onChange={set("interest")} className={inputClass}>
            {LEAD_INTERESTS.map((i) => (
              <option key={i} value={i}>
                {t(`interest.${i}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          {t("fields.source")}
          <select value={form.source} onChange={set("source")} className={inputClass}>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {t(`source.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          {t("fields.sourceNote")}
          <input value={form.sourceNote} onChange={set("sourceNote")} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t("fields.forWhom")}
          <input value={form.forWhom} onChange={set("forWhom")} placeholder={t("fields.forWhomPlaceholder")} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t("fields.location")}
          <input value={form.location} onChange={set("location")} placeholder={t("fields.locationPlaceholder")} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t("fields.firstMessageAt")}
          <input type="datetime-local" value={form.firstMessageAt} onChange={set("firstMessageAt")} className={inputClass} />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          {t("fields.keyWords")}
          <textarea rows={2} value={form.keyWords} onChange={set("keyWords")} placeholder={t("fields.keyWordsPlaceholder")} className={inputClass} />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          {t("fields.toldSoFar")}
          <textarea rows={2} value={form.toldSoFar} onChange={set("toldSoFar")} placeholder={t("fields.toldSoFarPlaceholder")} className={inputClass} />
        </label>
        <label className={labelClass}>
          {t("fields.callAt")}
          <input type="datetime-local" value={form.callAt} onChange={set("callAt")} className={inputClass} />
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.replied} onChange={set("replied")} />
          {t("fields.replied")}
        </label>
        <div className="flex justify-end sm:col-span-2">
          <button type="submit" disabled={pending} className={primaryButton}>
            {t("actions.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
