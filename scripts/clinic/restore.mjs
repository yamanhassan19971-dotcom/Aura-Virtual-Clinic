// Puts the clinic back to a backup. Stop the app first (the Windows
// restore.ps1 does that), then:
//
//   node scripts/clinic/restore.mjs                  lists the backups available
//   node scripts/clinic/restore.mjs <dump> --yes     restores that database dump
//
// <dump> is a file name from BACKUP_DIR/database or a full path (e.g. on the
// external drive). The current data is backed up first (label
// "before-restore"), so a restore can itself be undone. Documents and images
// missing from the app's folder are copied back from the backup's documents
// folder next to the dump; files already there are left alone.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { APP_DIR, loadSettings, log, pgTool, run } from "./common.mjs";

function restoreDocuments(from, to) {
  if (!existsSync(from)) return 0;
  mkdirSync(to, { recursive: true });
  let added = 0;
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) added += restoreDocuments(source, target);
    else if (entry.isFile() && !existsSync(target)) {
      copyFileSync(source, target);
      added++;
    }
  }
  return added;
}

function main() {
  const settings = loadSettings();
  const dbDir = path.join(settings.backupDir, "database");
  const target = process.argv.slice(2).find((a) => !a.startsWith("--"));

  if (!target) {
    const dumps = existsSync(dbDir) ? readdirSync(dbDir).filter((n) => n.endsWith(".dump")).sort().reverse() : [];
    console.log(dumps.length ? `Backups in ${dbDir} (newest first):\n` : `No backups in ${dbDir}`);
    for (const name of dumps) {
      console.log(`  ${name}   ${(statSync(path.join(dbDir, name)).size / 1_048_576).toFixed(1)} MB`);
    }
    if (dumps.length) console.log("\nRestore one with: node scripts/clinic/restore.mjs <name> --yes");
    return;
  }

  const dumpPath = existsSync(target) ? path.resolve(target) : path.join(dbDir, target);
  if (!existsSync(dumpPath)) throw new Error(`Backup not found: ${target}`);
  run(pgTool("pg_restore"), ["--list", dumpPath]); // readable before we touch anything
  if (!process.argv.includes("--yes")) {
    console.log(`This replaces ALL current clinic data with ${path.basename(dumpPath)}.`);
    console.log("Run again with --yes to go ahead.");
    process.exitCode = 2;
    return;
  }

  log("Backing up the current data first (label before-restore)");
  run(process.execPath, [path.join(APP_DIR, "scripts", "clinic", "backup.mjs"), "--label", "before-restore"], {
    stdio: "inherit",
  });

  log(`Restoring ${dumpPath}`);
  run(pgTool("pg_restore"), [
    "--clean",
    "--if-exists",
    "--no-owner",
    "--single-transaction",
    `--dbname=${settings.databaseUrl}`,
    dumpPath,
  ]);

  // An older backup may predate the app's newest tables; bring it up to date.
  log("Applying database updates");
  run(process.platform === "win32" ? "npx.cmd" : "npx", ["prisma", "migrate", "deploy"], {
    cwd: APP_DIR,
    shell: process.platform === "win32",
  });

  const added = restoreDocuments(path.join(path.dirname(path.dirname(dumpPath)), "documents"), settings.documentsDir);
  log(`Documents: ${added} file(s) put back`);
  log("Restore finished. Start the app again.");
}

try {
  main();
} catch (error) {
  log(`RESTORE FAILED: ${error.message}`);
  process.exitCode = 1;
}
