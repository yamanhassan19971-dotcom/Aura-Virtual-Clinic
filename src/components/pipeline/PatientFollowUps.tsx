"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { FollowUpItem } from "@/lib/services/pipeline-queries";
import { createFollowUpAction } from "@/lib/actions/pipeline-actions";
import { FollowUpList } from "@/components/pipeline/FollowUpList";
import {
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
  toLocalInput,
  usePipelineAction,
} from "@/components/pipeline/usePipelineAction";

/** The patient's follow-ups on their overview, with a quick "remind me to call" form. */
export function PatientFollowUps({
  patientId,
  items,
  canManage,
  nowIso,
}: {
  patientId: string;
  items: FollowUpItem[];
  canManage: boolean;
  nowIso: string;
}) {
  const t = useTranslations("pipeline.followUps");
  const { run, pending } = usePipelineAction();
  const [adding, setAdding] = useState(false);
  const [channel, setChannel] = useState<"CALL" | "WHATSAPP">("CALL");
  const [dueAt, setDueAt] = useState(() => {
    const d = new Date(nowIso);
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
    return toLocalInput(d);
  });
  const [note, setNote] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(() => createFollowUpAction({ patientId, channel, dueAt: new Date(dueAt).toISOString(), note }));
    if (ok) {
      setNote("");
      setAdding(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--color-text)]">{t("patientSection")}</h2>
        {canManage && !adding && (
          <button type="button" onClick={() => setAdding(true)} className={secondaryButton}>
            + {t("add")}
          </button>
        )}
      </div>
      {adding && (
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-lg border border-[var(--color-border)] bg-white p-4 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end">
          <label className={labelClass}>
            {t("when")}
            <input type="datetime-local" required value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={inputClass} />
          </label>
          <label className={labelClass}>
            {t("channel.CALL")} / {t("channel.WHATSAPP")}
            <select value={channel} onChange={(e) => setChannel(e.target.value as "CALL" | "WHATSAPP")} className={inputClass}>
              <option value="CALL">{t("channel.CALL")}</option>
              <option value="WHATSAPP">{t("channel.WHATSAPP")}</option>
            </select>
          </label>
          <label className={labelClass}>
            {t("what")}
            <input required value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
          </label>
          <button type="submit" disabled={pending} className={primaryButton}>
            {t("add")}
          </button>
        </form>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">{t("patientEmpty")}</p>
      ) : (
        <FollowUpList items={items} canManage={canManage} nowIso={nowIso} />
      )}
    </section>
  );
}
