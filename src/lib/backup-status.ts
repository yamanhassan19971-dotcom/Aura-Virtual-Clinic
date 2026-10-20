import { readFile } from "node:fs/promises";
import path from "node:path";

/** What scripts/clinic/backup.mjs writes after every run. */
export type BackupStatus = {
  ok: boolean;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  error: string | null;
  latestDump: string | null;
  dumpBytes: number | null;
  dumpCount: number | null;
  documentCount: number | null;
  backupDir: string;
  copy: { dir: string; ok: boolean; at: string; error: string | null } | null;
};

/** A daily backup older than this means the scheduled task stopped running. */
export const BACKUP_STALE_HOURS = 36;

/**
 * The backup state, or null where backups aren't set up (BACKUP_DIR unset,
 * as on a developer machine). `needsAttention` drives the warning shown to
 * the Admin and Manager: no backup yet, the last one failed, or none lately.
 */
export async function readBackupStatus(now = new Date()) {
  const backupDir = process.env.BACKUP_DIR;
  if (!backupDir) return null;
  let status: BackupStatus | null = null;
  try {
    status = JSON.parse(await readFile(path.join(/* turbopackIgnore: true */ backupDir, "backup-status.json"), "utf8"));
  } catch {
    // no backup has run yet
  }
  const lastSuccess = status?.lastSuccessAt ? new Date(status.lastSuccessAt) : null;
  const stale = !lastSuccess || now.getTime() - lastSuccess.getTime() > BACKUP_STALE_HOURS * 3_600_000;
  return { backupDir, status, stale, needsAttention: !status || !status.ok || stale };
}
