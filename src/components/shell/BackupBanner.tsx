import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { readBackupStatus } from "@/lib/backup-status";

/** Shown to the Admin and Manager on every page while backups are failing or late. */
export async function BackupBanner() {
  const backup = await readBackupStatus();
  if (!backup?.needsAttention) return null;
  const t = await getTranslations("backups");
  const format = await getFormatter();
  const last = backup.status?.lastSuccessAt;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-amber-100 px-4 py-2 text-sm text-amber-900 lg:px-6"
    >
      <span>{last ? t("banner", { when: format.relativeTime(new Date(last)) }) : t("bannerNever")}</span>
      <Link href="/settings/backups" className="font-semibold underline">
        {t("bannerLink")}
      </Link>
    </div>
  );
}
