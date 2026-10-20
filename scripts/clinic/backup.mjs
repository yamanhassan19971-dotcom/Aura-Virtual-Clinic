// Daily backup of the clinic: a full database dump plus every patient
// document and clinical image.
//
//   node scripts/clinic/backup.mjs            (scheduled every day by the installer)
//   node scripts/clinic/backup.mjs --label before-update
//
// BACKUP_DIR/
//   database/aura-2026-10-20_2130.dump   one per run; 30 days kept, then one per month for 12 months
//   documents/                           the files themselves, added to and never deleted or overwritten
//   backup-status.json                   last result; the app shows it under Settings → Backups
//
// When BACKUP_COPY_DIR is set (an external drive), the newest dump and the
// documents are copied there too. If that drive isn't plugged in the backup
// still succeeds and the status says the copy was skipped.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dumpsToDelete, loadSettings, log, pgTool, run, stamp } from "./common.mjs";

const label = process.argv.includes("--label") ? process.argv[process.argv.indexOf("--label") + 1] : null;

/** Copies files that `to` doesn't have yet; returns how many were added. */
function mirrorAddOnly(from, to) {
  if (!existsSync(from)) return 0;
  mkdirSync(to, { recursive: true });
  let added = 0;
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) added += mirrorAddOnly(source, target);
    else if (entry.isFile() && !existsSync(target)) {
      copyFileSync(source, target);
      added++;
    }
  }
  return added;
}

function countFiles(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir, { withFileTypes: true }).reduce(
    (n, e) => n + (e.isDirectory() ? countFiles(path.join(dir, e.name)) : e.isFile() ? 1 : 0),
    0
  );
}

function copyToDrive(settings, dumpPath) {
  if (!settings.copyDir) return null;
  const at = new Date().toISOString();
  if (!existsSync(settings.copyDir)) {
    return { dir: settings.copyDir, ok: false, at, error: "Drive not connected" };
  }
  try {
    const dbDir = path.join(settings.copyDir, "aura-backups", "database");
    mkdirSync(dbDir, { recursive: true });
    copyFileSync(dumpPath, path.join(dbDir, path.basename(dumpPath)));
    for (const old of dumpsToDelete(readdirSync(dbDir), new Date(), 14, 12)) rmSync(path.join(dbDir, old));
    mirrorAddOnly(path.join(settings.backupDir, "documents"), path.join(settings.copyDir, "aura-backups", "documents"));
    return { dir: settings.copyDir, ok: true, at, error: null };
  } catch (error) {
    return { dir: settings.copyDir, ok: false, at, error: error.message };
  }
}

function main() {
  const settings = loadSettings();
  const statusFile = path.join(settings.backupDir, "backup-status.json");
  const dbDir = path.join(settings.backupDir, "database");
  mkdirSync(dbDir, { recursive: true });
  const startedAt = new Date();
  const dumpPath = path.join(dbDir, `aura-${stamp(startedAt)}${label ? `-${label}` : ""}.dump`);
  try {
    log(`Dumping database to ${dumpPath}`);
    run(pgTool("pg_dump"), ["--format=custom", "--no-owner", `--file=${dumpPath}`, `--dbname=${settings.databaseUrl}`]);
    // A dump that pg_restore can't read is no backup; check it now, not on the day it's needed.
    const contents = run(pgTool("pg_restore"), ["--list", dumpPath]);
    if (!/TABLE DATA public patients/.test(contents)) throw new Error("Dump is missing the patients table");

    const added = mirrorAddOnly(settings.documentsDir, path.join(settings.backupDir, "documents"));
    log(`Documents: ${added} new file(s) copied`);

    const removed = dumpsToDelete(readdirSync(dbDir), startedAt, settings.keepDays, settings.keepMonths);
    for (const name of removed) rmSync(path.join(dbDir, name));
    if (removed.length) log(`Removed ${removed.length} old dump(s)`);

    const copy = copyToDrive(settings, dumpPath);
    if (copy) log(copy.ok ? `Copied to ${copy.dir}` : `Copy to ${copy.dir} skipped: ${copy.error}`);

    const status = {
      ok: true,
      lastSuccessAt: new Date().toISOString(),
      lastAttemptAt: startedAt.toISOString(),
      error: null,
      latestDump: path.basename(dumpPath),
      dumpBytes: statSync(dumpPath).size,
      dumpCount: readdirSync(dbDir).filter((n) => n.endsWith(".dump")).length,
      documentCount: countFiles(path.join(settings.backupDir, "documents")),
      backupDir: settings.backupDir,
      copy,
    };
    writeFileSync(statusFile, JSON.stringify(status, null, 2));
    log("Backup finished");
  } catch (error) {
    if (existsSync(dumpPath)) rmSync(dumpPath);
    let previous = {};
    try {
      previous = JSON.parse(readFileSync(statusFile, "utf8"));
    } catch {
      // first run, or an unreadable file: start a fresh status
    }
    writeFileSync(
      statusFile,
      JSON.stringify(
        { ...previous, ok: false, lastAttemptAt: startedAt.toISOString(), error: error.message, backupDir: settings.backupDir },
        null,
        2
      )
    );
    log(`BACKUP FAILED: ${error.message}`);
    process.exitCode = 1;
  }
}

main();
