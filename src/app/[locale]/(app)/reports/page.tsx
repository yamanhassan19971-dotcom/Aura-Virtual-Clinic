import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Link } from "@/i18n/navigation";
import { parseDateParam, toDateParam } from "@/lib/time";
import {
  ATTENDANCE_TARGET,
  REPLY_TARGET_MINUTES,
  pipelineBreakdown,
  weekKpis,
  weekStartOf,
  type WeekKpis,
} from "@/lib/services/kpi-queries";

function pct(value: number | null) {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function minutes(value: number | null) {
  return value === null ? "—" : value < 10 ? value.toFixed(1).replace(/\.0$/, "") : String(Math.round(value));
}

type Tone = "good" | "bad" | "neutral";
const TONE: Record<Tone, string> = {
  good: "text-emerald-700",
  bad: "text-rose-700",
  neutral: "text-[var(--color-text)]",
};

function Kpi({ title, value, hint, detail, tone = "neutral" }: { title: string; value: string; hint: string; detail?: string; tone?: Tone }) {
  return (
    <section className="flex flex-col gap-1 rounded-lg border border-[var(--color-border)] bg-white p-4" data-testid="kpi">
      <h2 className="text-sm font-semibold text-gray-600">{title}</h2>
      <p className={`text-3xl font-semibold tabular-nums ${TONE[tone]}`}>{value}</p>
      {detail && <p className="text-xs text-gray-500">{detail}</p>}
      <p className="mt-auto pt-2 text-xs text-gray-400">{hint}</p>
    </section>
  );
}

// The six weekly numbers from the patient-journey playbook.
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const session = await auth();
  if (!can(session!.user.role, "reports.view")) notFound();
  const practiceId = session!.user.practiceId;
  const t = await getTranslations("pipeline.reports");
  const tLeads = await getTranslations("pipeline.leads");
  const locale = await getLocale();

  const start = weekStartOf(parseDateParam(week));
  const weeks = [0, 1, 2, 3].map((i) => {
    const d = new Date(start);
    d.setDate(d.getDate() - 7 * i);
    return d;
  });
  const [current, ...previous] = await Promise.all(weeks.map((w) => weekKpis(practiceId, w)));
  const breakdown = await pipelineBreakdown(practiceId, start);
  const isThisWeek = toDateParam(start) === toDateParam(weekStartOf(new Date()));
  const prevWeek = new Date(start);
  prevWeek.setDate(prevWeek.getDate() - 7);
  const nextWeek = new Date(start);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const dateLabel = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date(iso));

  const rows: { label: string; get: (k: WeekKpis) => string }[] = [
    { label: t("replySpeed"), get: (k) => minutes(k.medianReplyMinutes) },
    { label: t("leadToCall"), get: (k) => pct(k.leadToCall) },
    { label: t("callToConsult"), get: (k) => pct(k.callToConsult) },
    { label: t("attendance"), get: (k) => pct(k.attendance) },
    { label: t("acceptance"), get: (k) => pct(k.acceptance) },
    { label: t("reviews"), get: (k) => String(k.reviewsRequested) },
  ];
  const trend = [...previous].reverse().concat(current);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-border)] bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text)]">{t("title")}</h1>
          <p className="text-sm text-gray-500">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/reports?week=${toDateParam(prevWeek)}`} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 hover:bg-gray-50">
            {t("prev")}
          </Link>
          <span className="font-medium">{isThisWeek ? t("thisWeek") : t("week", { date: dateLabel(current.weekStart) })}</span>
          {!isThisWeek && (
            <Link href={`/reports?week=${toDateParam(nextWeek)}`} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 hover:bg-gray-50">
              {t("next")}
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 p-6">
        <p className="text-sm text-gray-600">{t("newLeads", { count: current.newLeads })}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Kpi
            title={t("replySpeed")}
            value={current.medianReplyMinutes === null ? "—" : t("minutes", { value: minutes(current.medianReplyMinutes) })}
            detail={current.repliedWithinTarget === null ? undefined : t("withinTarget", { percent: pct(current.repliedWithinTarget) })}
            hint={t("replySpeedHint")}
            tone={
              current.medianReplyMinutes === null ? "neutral" : current.medianReplyMinutes <= REPLY_TARGET_MINUTES ? "good" : "bad"
            }
          />
          <Kpi title={t("leadToCall")} value={pct(current.leadToCall)} hint={t("leadToCallHint")} />
          <Kpi title={t("callToConsult")} value={pct(current.callToConsult)} hint={t("callToConsultHint")} />
          <Kpi
            title={t("attendance")}
            value={pct(current.attendance)}
            detail={t("attendanceDetail", { attended: current.attended, missed: current.missed })}
            hint={t("attendanceHint")}
            tone={current.attendance === null ? "neutral" : current.attendance >= ATTENDANCE_TARGET ? "good" : "bad"}
          />
          <Kpi
            title={t("acceptance")}
            value={pct(current.acceptance)}
            detail={t("acceptanceDetail", { accepted: current.accepted, declined: current.declined })}
            hint={t("acceptanceHint")}
          />
          <Kpi
            title={t("reviews")}
            value={String(current.reviewsRequested)}
            detail={
              current.averageSatisfaction === null
                ? undefined
                : t("satisfaction", { score: current.averageSatisfaction.toFixed(1) })
            }
            hint={t("reviewsHint")}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className="min-w-0 rounded-lg border border-[var(--color-border)] bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-600">{t("trend")}</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-xs text-gray-400">
                    <th className="py-2 text-start font-medium">{t("metric")}</th>
                    {trend.map((k) => (
                      <th key={k.weekStart} className="py-2 text-end font-medium">
                        {dateLabel(k.weekStart)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-2 text-gray-600">{r.label}</td>
                      {trend.map((k, i) => (
                        <td key={k.weekStart} className={`py-2 text-end ${i === trend.length - 1 ? "font-semibold" : ""}`}>
                          {r.get(k)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="flex flex-col gap-4">
            <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-600">{t("sources")}</h2>
              {breakdown.sources.length === 0 ? (
                <p className="text-xs text-gray-400">{t("noData")}</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {breakdown.sources.map((s) => (
                    <li key={s.source} className="flex justify-between">
                      <span>{tLeads(`source.${s.source}`)}</span>
                      <span className="tabular-nums text-gray-500">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-600">{t("lostReasons")}</h2>
              {breakdown.lostReasons.length === 0 ? (
                <p className="text-xs text-gray-400">{t("noData")}</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {breakdown.lostReasons.map((l) => (
                    <li key={l.reason} className="flex justify-between">
                      <span>{tLeads(`lostReason.${l.reason}`)}</span>
                      <span className="tabular-nums text-gray-500">{l.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
        <p className="rounded-md bg-blue-50/60 px-4 py-3 text-sm text-gray-600">{t("meeting")}</p>
      </div>
    </div>
  );
}
