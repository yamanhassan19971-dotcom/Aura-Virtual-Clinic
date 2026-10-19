"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { LeadActivityKind, LeadInterest, LeadSource, LeadStage } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { formatLongDate, formatTime } from "@/lib/time";
import { LOST_REASONS } from "@/lib/validation/pipeline";
import {
  logLeadContactAction,
  markLeadLostAction,
  markLeadRepliedAction,
  markLeadThinkingAction,
  reopenLeadAction,
  scheduleLeadCallAction,
} from "@/lib/actions/pipeline-actions";
import { MessageBox } from "@/components/pipeline/MessageBox";
import { LeadStageBadge } from "@/components/pipeline/LeadStageBadge";
import { BookConsultationModal, type BookingOptions } from "@/components/pipeline/BookConsultationModal";
import {
  inputClass,
  labelClass,
  primaryButton,
  secondaryButton,
  toLocalInput,
  usePipelineAction,
} from "@/components/pipeline/usePipelineAction";

export type LeadDetailView = {
  id: string;
  leadNumber: string;
  name: string;
  phone: string;
  source: LeadSource;
  sourceNote: string | null;
  interest: LeadInterest;
  forWhom: string | null;
  location: string | null;
  keyWords: string | null;
  toldSoFar: string | null;
  stage: LeadStage;
  lostReason: string | null;
  firstMessageAt: string;
  firstReplyAt: string | null;
  callAt: string | null;
  callAttempts: number;
  assignedTo: string | null;
  patient: { id: string; name: string; code: string } | null;
  consultation: { startTime: string; doctor: string; type: string; status: string } | null;
  activities: { id: string; kind: LeadActivityKind; note: string | null; at: string; by: string | null }[];
};

export type QuickMessage = { kind: string; text: string; whatsAppUrl: string | null };

const OPEN: LeadStage[] = ["NEW", "CALL_BOOKED", "THINKING"];

function dateTime(iso: string, locale: string) {
  const d = new Date(iso);
  return `${formatLongDate(d, locale)} · ${formatTime(d, locale)}`;
}

function Field({ label, value, dir }: { label: string; value: string | null; dir?: "ltr" }) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="whitespace-pre-line text-sm text-[var(--color-text)]" dir={dir}>
        {value}
      </dd>
    </div>
  );
}

export function LeadDetailPanel({
  lead,
  messages,
  telUrl,
  booking,
  canManage,
  nowIso,
}: {
  lead: LeadDetailView;
  messages: QuickMessage[];
  telUrl: string | null;
  booking: BookingOptions;
  canManage: boolean;
  nowIso: string;
}) {
  const t = useTranslations("pipeline.leads");
  const locale = useLocale();
  const { run, pending } = usePipelineAction();
  const now = new Date(nowIso);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + (tomorrow.getDay() === 4 ? 2 : 1));
  tomorrow.setHours(12, 0, 0, 0);

  const [note, setNote] = useState("");
  const [callAt, setCallAt] = useState(
    toLocalInput(lead.callAt && new Date(lead.callAt) > now ? new Date(lead.callAt) : tomorrow)
  );
  const [lostReason, setLostReason] = useState<(typeof LOST_REASONS)[number]>("PRICE");
  const [messageKind, setMessageKind] = useState(messages[0]?.kind ?? "");
  const [booking_, setBooking] = useState(false);
  const isOpen = OPEN.includes(lead.stage);
  const message = messages.find((m) => m.kind === messageKind) ?? messages[0];

  async function act(fn: () => ReturnType<typeof logLeadContactAction>) {
    const ok = await run(fn);
    if (ok) setNote("");
  }
  const at = () => new Date(callAt).toISOString();
  const noteValue = note.trim() || null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="rounded-lg border border-[var(--color-border)] bg-white p-5">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{t("handoffCard")}</h2>
            <LeadStageBadge stage={lead.stage} />
          </div>
          <p className="mb-4 text-xs text-gray-400">{t("handoffHint")}</p>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("fields.phone")} value={lead.phone} dir="ltr" />
            <Field
              label={t("fields.source")}
              value={`${t(`source.${lead.source}`)}${lead.sourceNote ? ` · ${lead.sourceNote}` : ""}`}
            />
            <Field
              label={t("fields.interest")}
              value={`${t(`interest.${lead.interest}`)}${lead.forWhom ? ` · ${lead.forWhom}` : ""}`}
            />
            <Field label={t("fields.location")} value={lead.location} />
            <div className="sm:col-span-2">
              <Field label={t("fields.keyWords")} value={lead.keyWords} />
            </div>
            <div className="sm:col-span-2">
              <Field label={t("fields.toldSoFar")} value={lead.toldSoFar} />
            </div>
            <Field label={t("fields.firstMessageAt")} value={dateTime(lead.firstMessageAt, locale)} />
            {lead.firstReplyAt && (
              <Field
                label={t("activity.REPLIED")}
                value={t("repliedIn", {
                  minutes: Math.max(
                    0,
                    Math.round((new Date(lead.firstReplyAt).getTime() - new Date(lead.firstMessageAt).getTime()) / 60000)
                  ),
                })}
              />
            )}
            {lead.callAt && isOpen && <Field label={t("nextCall")} value={dateTime(lead.callAt, locale)} />}
            {lead.lostReason && <Field label={t("reason")} value={t(`lostReason.${lead.lostReason}`)} />}
            <Field label={t("assigned")} value={lead.assignedTo} />
          </dl>
          {(lead.patient || lead.consultation) && (
            <div className="mt-4 flex flex-wrap gap-4 border-t border-[var(--color-border)] pt-4 text-sm">
              {lead.patient && (
                <Link href={`/patients/${lead.patient.id}`} className="font-medium text-[var(--color-blue)] hover:underline">
                  {t("patientFile")}: {lead.patient.name} ({lead.patient.code})
                </Link>
              )}
              {lead.consultation && (
                <span className="text-gray-600">
                  {t("consultation")}: {dateTime(lead.consultation.startTime, locale)} · {lead.consultation.doctor}
                </span>
              )}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-[var(--color-border)] bg-white p-5">
          <h2 className="mb-3 text-base font-semibold">{t("timeline")}</h2>
          <ol className="flex flex-col gap-3">
            {lead.activities.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-blue)]" />
                <div className="min-w-0">
                  <div>
                    <span className="font-medium">{t(`activity.${a.kind}`)}</span>
                    <span className="text-xs text-gray-400">
                      {" "}
                      · {dateTime(a.at, locale)}
                      {a.by && ` · ${a.by}`}
                    </span>
                  </div>
                  {a.note && <p className="whitespace-pre-line text-gray-600">{a.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <aside className="flex flex-col gap-4">
        {canManage && isOpen && (
          <section className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-white p-4">
            {!lead.firstReplyAt && (
              <button
                type="button"
                disabled={pending}
                onClick={() => act(() => markLeadRepliedAction({ leadId: lead.id }))}
                className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                {t("actions.markReplied")}
              </button>
            )}
            <button type="button" onClick={() => setBooking(true)} className={primaryButton}>
              {t("actions.book")}
            </button>
            <label className={labelClass}>
              {t("note")}
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                className={secondaryButton}
                onClick={() => act(() => logLeadContactAction({ leadId: lead.id, outcome: "NO_ANSWER", note: noteValue }))}
              >
                {t("actions.noAnswer")}
              </button>
              <button
                type="button"
                disabled={pending}
                className={secondaryButton}
                onClick={() => act(() => logLeadContactAction({ leadId: lead.id, outcome: "REACHED", note: noteValue }))}
              >
                {t("actions.reached")}
              </button>
              <button
                type="button"
                disabled={pending || !noteValue}
                className={secondaryButton}
                onClick={() => act(() => logLeadContactAction({ leadId: lead.id, outcome: "NOTE", note: noteValue }))}
              >
                {t("actions.addNote")}
              </button>
            </div>
            <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
              <label className={labelClass}>
                {t("followUpAt")}
                <input type="datetime-local" value={callAt} onChange={(e) => setCallAt(e.target.value)} className={inputClass} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className={secondaryButton}
                  onClick={() => act(() => scheduleLeadCallAction({ leadId: lead.id, callAt: at(), note: noteValue }))}
                >
                  {t("actions.scheduleCall")}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className={secondaryButton}
                  onClick={() => act(() => markLeadThinkingAction({ leadId: lead.id, followUpAt: at(), note: noteValue }))}
                >
                  {t("actions.thinking")}
                </button>
              </div>
            </div>
            <div className="flex items-end gap-2 border-t border-[var(--color-border)] pt-3">
              <label className={`${labelClass} flex-1`}>
                {t("reason")}
                <select
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value as (typeof LOST_REASONS)[number])}
                  className={inputClass}
                >
                  {LOST_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {t(`lostReason.${r}`)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={pending}
                className={secondaryButton}
                onClick={() => act(() => markLeadLostAction({ leadId: lead.id, reason: lostReason, note: noteValue }))}
              >
                {t("actions.lost")}
              </button>
            </div>
          </section>
        )}

        {canManage && lead.stage === "LOST" && (
          <button
            type="button"
            disabled={pending}
            onClick={() => act(() => reopenLeadAction({ leadId: lead.id }))}
            className={secondaryButton}
          >
            {t("actions.reopen")}
          </button>
        )}

        {message && (
          <section className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{t("quickMessages")}</h2>
              <select value={messageKind} onChange={(e) => setMessageKind(e.target.value)} className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs">
                {messages.map((m) => (
                  <option key={m.kind} value={m.kind}>
                    {t(`messageKind.${m.kind}`)}
                  </option>
                ))}
              </select>
            </div>
            <MessageBox text={message.text} whatsAppUrl={message.whatsAppUrl} telUrl={telUrl} />
          </section>
        )}
      </aside>

      {booking_ && (
        <BookConsultationModal
          leadId={lead.id}
          leadName={lead.name}
          options={booking}
          defaultDate={toLocalInput(tomorrow).slice(0, 10)}
          onClose={() => setBooking(false)}
        />
      )}
    </div>
  );
}
