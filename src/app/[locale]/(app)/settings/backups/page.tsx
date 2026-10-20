import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { readBackupStatus } from "@/lib/backup-status";

export default async function BackupsSettingsPage() {
  const session = await auth();
  if (!session || !can(session.user.role, "settings.manage")) notFound();
  const t = await getTranslations("backups");
  const format = await getFormatter();
  const backup = await readBackupStatus();
  const when = (iso: string | null | undefined) =>
    iso ? format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" }) : "—";

  if (!backup) {
    return (
      <p className="max-w-2xl rounded-lg border border-[var(--color-border)] bg-white p-5 text-sm">{t("notSetUp")}</p>
    );
  }
  const { status } = backup;
  const rows: Array<[string, React.ReactNode]> = status
    ? [
        [t("lastSuccess"), when(status.lastSuccessAt)],
        [t("lastAttempt"), when(status.lastAttemptAt)],
        [t("location"), <span key="dir" dir="ltr">{status.backupDir}</span>],
        [
          t("size"),
          status.dumpBytes != null ? <span dir="ltr">{(status.dumpBytes / 1_048_576).toFixed(1)} MB</span> : "—",
        ],
        [t("count"), status.dumpCount ?? "—"],
        [t("documents"), status.documentCount ?? "—"],
        [
          t("copy"),
          !status.copy
            ? t("copyNotSet")
            : status.copy.ok
              ? t("copyOk", { when: when(status.copy.at) })
              : t("copyFailed", { error: status.copy.error ?? "" }),
        ],
      ]
    : [];

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="text-sm text-gray-500">{t("intro")}</p>
      {backup.needsAttention && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">
            {!status ? t("never") : !status.ok ? t("failed") : t("banner", { when: when(status.lastSuccessAt) })}
          </p>
          {status?.error && (
            <p dir="ltr" className="mt-1 break-words text-start font-mono text-xs">
              {status.error}
            </p>
          )}
        </div>
      )}
      {status && (
        <dl
          data-testid="backup-status"
          className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 rounded-lg border border-[var(--color-border)] bg-white p-5 text-sm"
        >
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-gray-500">{label}</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-xs text-gray-500">{t("howToRestore")}</p>
    </div>
  );
}
