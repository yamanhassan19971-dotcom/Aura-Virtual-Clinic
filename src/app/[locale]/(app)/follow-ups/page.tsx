import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { Link } from "@/i18n/navigation";
import { FOLLOW_UP_VIEWS } from "@/lib/validation/pipeline";
import { listFollowUps, withMessages, type FollowUpView } from "@/lib/services/pipeline-queries";
import { FollowUpList } from "@/components/pipeline/FollowUpList";

// The caller's daily list: reminders, post-op check-ins, plan follow-ups,
// satisfaction and review requests, recalls and missed-appointment rebooks.
export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: viewParam } = await searchParams;
  const session = await auth();
  if (!can(session!.user.role, "followUps.view")) notFound();
  const t = await getTranslations("pipeline.followUps");
  const view: FollowUpView = FOLLOW_UP_VIEWS.includes(viewParam as FollowUpView) ? (viewParam as FollowUpView) : "today";
  const now = new Date();
  const rows = await listFollowUps(session!.user.practiceId, view, now);
  const items = withMessages(rows, session!.user.name, now);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--color-border)] bg-white px-4 md:px-6 py-4">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">{t("title")}</h1>
        <p className="max-w-3xl text-sm text-gray-500">{t("subtitle")}</p>
      </div>
      <div className="flex max-w-4xl flex-col gap-4 p-4 md:p-6">
        <div className="flex flex-wrap gap-2">
          {FOLLOW_UP_VIEWS.map((v) => (
            <Link
              key={v}
              href={`/follow-ups?view=${v}`}
              className={`rounded-full border px-3 py-1 text-sm ${
                v === view
                  ? "border-[var(--color-blue)] bg-[var(--color-blue)] text-white"
                  : "border-[var(--color-border)] bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t(`views.${v}`)}
              {v === view && <span className="ms-1 text-white/80">{items.length}</span>}
            </Link>
          ))}
        </div>
        <FollowUpList items={items} canManage={can(session!.user.role, "followUps.manage")} nowIso={now.toISOString()} />
      </div>
    </div>
  );
}
