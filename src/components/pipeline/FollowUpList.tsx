"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FollowUpKind } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import { formatTime } from "@/lib/time";
import type { FollowUpItem } from "@/lib/services/pipeline-queries";
import {
  completeFollowUpAction,
  rescheduleFollowUpAction,
  skipFollowUpAction,
} from "@/lib/actions/pipeline-actions";
import { MessageBox } from "@/components/pipeline/MessageBox";
import { inputClass, primaryButton, secondaryButton, usePipelineAction } from "@/components/pipeline/usePipelineAction";

const KIND_TONE: Partial<Record<FollowUpKind, string>> = {
  CONFIRM_BOOKING: "bg-blue-50 text-blue-700",
  REMIND_DAY_BEFORE: "bg-blue-50 text-blue-700",
  REMIND_3H: "bg-blue-50 text-blue-700",
  POST_OP_EVENING: "bg-teal-50 text-teal-700",
  POST_OP_NEXT_DAY: "bg-teal-50 text-teal-700",
  POST_OP_WEEK: "bg-teal-50 text-teal-700",
  PLAN_DECISION: "bg-amber-50 text-amber-800",
  SATISFACTION: "bg-violet-50 text-violet-700",
  REVIEW_REQUEST: "bg-violet-50 text-violet-700",
  RECALL: "bg-gray-100 text-gray-700",
  REBOOK_MISSED: "bg-rose-50 text-rose-700",
};

function dayAndTime(iso: string, locale: string, todayIso: string) {
  const d = new Date(iso);
  if (d.toDateString() === new Date(todayIso).toDateString()) return formatTime(d, locale);
  return `${new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "numeric" }).format(d)} ${formatTime(d, locale)}`;
}

function nextWorkingDayNoon(fromIso: string) {
  const d = new Date(fromIso);
  d.setDate(d.getDate() + 1);
  if (d.getDay() === 5) d.setDate(d.getDate() + 1);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function FollowUpRow({ item, canManage, nowIso }: { item: FollowUpItem; canManage: boolean; nowIso: string }) {
  const t = useTranslations("pipeline.followUps");
  const locale = useLocale();
  const { run, pending } = usePipelineAction();
  const [outcome, setOutcome] = useState("");
  const [score, setScore] = useState("");
  const [expanded, setExpanded] = useState(false);
  const isDue = item.status === "DUE";
  const needsScore = item.kind === "SATISFACTION";

  const context = item.context
    ? item.context.kind === "appointment"
      ? t("appointment", {
          type: item.context.type,
          doctor: item.context.doctor,
          time: dayAndTime(item.context.appointmentAt, locale, nowIso),
        })
      : t("plan", { number: item.context.planNumber, title: item.context.planTitle })
    : null;

  return (
    <li
      data-testid="follow-up"
      data-kind={item.kind}
      className={`rounded-lg border bg-white p-4 ${item.overdue ? "border-rose-300" : "border-[var(--color-border)]"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${KIND_TONE[item.kind] ?? "bg-gray-100 text-gray-700"}`}>
              {t(`kind.${item.kind}`)}
            </span>
            <span className="text-xs text-gray-500">{t(`channel.${item.channel}`)}</span>
            {item.overdue && <span className="text-xs font-semibold text-rose-700">{t("overdue")}</span>}
          </div>
          <Link href={`/patients/${item.patient.id}`} className="mt-1 block font-medium text-[var(--color-text)] hover:underline">
            {item.patient.name}{" "}
            <span className="text-xs font-normal text-gray-400" dir="ltr">
              {item.patient.code}
              {item.patient.phone && ` · ${item.patient.phone}`}
            </span>
          </Link>
          {context && <p className="text-xs text-gray-500">{context}</p>}
        </div>
        <div className="text-end text-sm">
          {isDue ? (
            <span className="text-gray-600">{dayAndTime(item.dueAt, locale, nowIso)}</span>
          ) : (
            <span className="text-gray-500">
              {item.status === "SKIPPED" ? t("skipped") : t("done")}
              {item.completedBy && ` · ${t("completedBy", { name: item.completedBy })}`}
              {item.satisfactionScore && <span className="block font-semibold">{item.satisfactionScore}/10</span>}
            </span>
          )}
        </div>
      </div>

      {isDue ? (
        <div className="mt-3 flex flex-col gap-3">
          <div>
            <p className="mb-1 text-xs font-medium text-gray-400">{item.channel === "CALL" ? t("callOpener") : t("message")}</p>
            <div onClick={() => setExpanded(true)}>
              <MessageBox
                text={item.message}
                whatsAppUrl={item.whatsAppUrl}
                telUrl={item.channel === "CALL" ? item.telUrl : null}
                compact={!expanded}
              />
            </div>
          </div>
          {canManage && (
            <div className="flex flex-wrap items-end gap-2 border-t border-[var(--color-border)] pt-3">
              {needsScore && (
                <label className="flex w-28 flex-col gap-1 text-xs font-medium text-gray-600">
                  {t("score")}
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    className={inputClass}
                  />
                </label>
              )}
              <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-gray-600">
                {t("outcome")}
                <input value={outcome} onChange={(e) => setOutcome(e.target.value)} className={inputClass} />
              </label>
              <button
                type="button"
                disabled={pending || (needsScore && !score)}
                className={primaryButton}
                onClick={() =>
                  run(() =>
                    completeFollowUpAction({
                      followUpId: item.id,
                      outcome: outcome || null,
                      satisfactionScore: needsScore ? Number(score) : null,
                    })
                  )
                }
              >
                {t("done")}
              </button>
              <button
                type="button"
                disabled={pending}
                className={secondaryButton}
                onClick={() => run(() => rescheduleFollowUpAction({ followUpId: item.id, dueAt: nextWorkingDayNoon(nowIso) }))}
              >
                {t("tomorrow")}
              </button>
              <button
                type="button"
                disabled={pending}
                className={secondaryButton}
                onClick={() => run(() => skipFollowUpAction({ followUpId: item.id, outcome: outcome || null }))}
              >
                {t("skip")}
              </button>
              {needsScore && <p className="w-full text-xs text-gray-400">{t("scoreHint")}</p>}
            </div>
          )}
        </div>
      ) : (
        item.outcome && <p className="mt-2 text-sm text-gray-600">{item.outcome}</p>
      )}
    </li>
  );
}

export function FollowUpList({ items, canManage, nowIso }: { items: FollowUpItem[]; canManage: boolean; nowIso: string }) {
  const t = useTranslations("pipeline.followUps");
  if (items.length === 0) return <p className="py-10 text-center text-sm text-gray-400">{t("empty")}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <FollowUpRow key={item.id} item={item} canManage={canManage} nowIso={nowIso} />
      ))}
    </ul>
  );
}
