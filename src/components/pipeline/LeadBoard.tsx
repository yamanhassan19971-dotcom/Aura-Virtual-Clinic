"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { LeadInterest, LeadSource, LeadStage } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { formatTime } from "@/lib/time";
import { NewLeadModal } from "@/components/pipeline/NewLeadModal";
import { primaryButton } from "@/components/pipeline/usePipelineAction";

export type LeadCardView = {
  id: string;
  leadNumber: string;
  name: string;
  phone: string;
  source: LeadSource;
  interest: LeadInterest;
  forWhom: string | null;
  location: string | null;
  stage: LeadStage;
  lostReason: string | null;
  waitingMinutes: number | null;
  replyMinutes: number | null;
  callAt: string | null;
  callDue: boolean;
  callAttempts: number;
  consultAt: string | null;
  consultDoctor: string | null;
};

const OPEN_COLUMNS: LeadStage[] = ["NEW", "CALL_BOOKED", "THINKING", "CONSULT_BOOKED"];
const CLOSED_COLUMNS: LeadStage[] = ["ATTENDED", "LOST"];
const COLUMN_ACCENT: Record<LeadStage, string> = {
  NEW: "border-t-rose-400",
  CALL_BOOKED: "border-t-blue-400",
  THINKING: "border-t-amber-400",
  CONSULT_BOOKED: "border-t-teal-500",
  ATTENDED: "border-t-emerald-500",
  LOST: "border-t-gray-300",
};

function when(iso: string, locale: string, todayIso: string) {
  const d = new Date(iso);
  const today = new Date(todayIso);
  const sameDay = d.toDateString() === today.toDateString();
  const day = sameDay
    ? ""
    : `${new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "numeric" }).format(d)} `;
  return `${day}${formatTime(d, locale)}`;
}

function LeadCard({ lead, nowIso }: { lead: LeadCardView; nowIso: string }) {
  const t = useTranslations("pipeline.leads");
  const locale = useLocale();
  const late = lead.stage === "NEW" && lead.waitingMinutes !== null && lead.waitingMinutes > 5;

  let status: React.ReactNode = null;
  if (lead.stage === "NEW" && lead.waitingMinutes !== null) {
    status = (
      <span className={late ? "font-semibold text-rose-700" : "text-gray-500"}>
        {lead.waitingMinutes >= 120
          ? t("waitingHours", { hours: Math.floor(lead.waitingMinutes / 60) })
          : t("waiting", { minutes: lead.waitingMinutes })}
      </span>
    );
  } else if ((lead.stage === "CALL_BOOKED" || lead.stage === "THINKING") && lead.callAt) {
    status = (
      <span className={lead.callDue ? "font-semibold text-blue-700" : "text-gray-500"}>
        {lead.callDue ? t("callDue") : t("callAt", { time: when(lead.callAt, locale, nowIso) })}
        {lead.callAttempts > 0 && <span className="text-gray-400"> · {t("attempts", { count: lead.callAttempts })}</span>}
      </span>
    );
  } else if (lead.stage === "CONSULT_BOOKED" && lead.consultAt) {
    status = (
      <span className="text-gray-500">
        {t("consultAt", { time: when(lead.consultAt, locale, nowIso) })}
        {lead.consultDoctor && ` · ${lead.consultDoctor}`}
      </span>
    );
  } else if (lead.stage === "LOST" && lead.lostReason) {
    status = <span className="text-gray-500">{t(`lostReason.${lead.lostReason}`)}</span>;
  }

  return (
    <Link
      href={`/leads/${lead.id}`}
      data-testid="lead-card"
      className={`block rounded-md border bg-white p-3 shadow-sm transition hover:border-[var(--color-blue)] ${
        late || lead.callDue ? "border-rose-300" : "border-[var(--color-border)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-[var(--color-text)]">{lead.name}</span>
        <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{t(`interest.${lead.interest}`)}</span>
      </div>
      <div className="mt-1 text-xs text-gray-400">
        {t(`source.${lead.source}`)}
        {lead.forWhom && ` · ${lead.forWhom}`}
        {lead.location && ` · ${lead.location}`}
      </div>
      {status && <div className="mt-2 text-xs">{status}</div>}
    </Link>
  );
}

export function LeadBoard({
  columns,
  nowIso,
  canManage,
  initialQuery,
}: {
  columns: Record<LeadStage, LeadCardView[]>;
  nowIso: string;
  canManage: boolean;
  initialQuery: string;
}) {
  const t = useTranslations("pipeline.leads");
  const [creating, setCreating] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const visible = showClosed ? CLOSED_COLUMNS : OPEN_COLUMNS;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {canManage && (
          <button type="button" onClick={() => setCreating(true)} className={primaryButton}>
            + {t("new")}
          </button>
        )}
        <form className="flex-1">
          <input
            name="q"
            defaultValue={initialQuery}
            placeholder={t("search")}
            className="w-full max-w-xs rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
          />
        </form>
        <div className="flex rounded-md border border-[var(--color-border)] bg-white p-0.5 text-sm">
          {[false, true].map((closed) => (
            <button
              key={String(closed)}
              type="button"
              onClick={() => setShowClosed(closed)}
              className={`rounded px-3 py-1 ${showClosed === closed ? "bg-[var(--color-navy)] text-white" : "text-gray-600"}`}
            >
              {closed ? t("closed") : t("title")}
            </button>
          ))}
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto pb-2">
        <div className={`grid min-w-[900px] gap-3 px-1 ${showClosed ? "grid-cols-2" : "grid-cols-4"}`}>
          {visible.map((stage) => (
            <section
              key={stage}
              data-testid={`lead-column-${stage}`}
              className={`flex flex-col gap-2 rounded-lg border border-t-4 border-[var(--color-border)] bg-gray-50/70 p-2.5 ${COLUMN_ACCENT[stage]}`}
            >
              <header className="px-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--color-text)]">{t(`stage.${stage}`)}</h2>
                  <span className="text-xs font-medium text-gray-400">{columns[stage].length}</span>
                </div>
                <p className="text-xs text-gray-400">{t(`stageHint.${stage}`)}</p>
              </header>
              {columns[stage].length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-gray-300">{t("empty")}</p>
              ) : (
                columns[stage].map((lead) => <LeadCard key={lead.id} lead={lead} nowIso={nowIso} />)
              )}
            </section>
          ))}
        </div>
      </div>

      {creating && <NewLeadModal onClose={() => setCreating(false)} nowIso={nowIso} />}
    </div>
  );
}
