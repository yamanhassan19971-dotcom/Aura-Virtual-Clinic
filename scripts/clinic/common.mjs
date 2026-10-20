// Shared by the clinic's backup and restore scripts. Plain Node (no build
// step, no packages) so they run the same on the clinic's Windows laptop and
// on Linux. Settings come from the app's .env file.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function loadSettings() {
  const envFile = path.join(APP_DIR, ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set (expected in .env)");
  return {
    databaseUrl,
    documentsDir: process.env.DOCUMENT_STORAGE_ROOT ?? path.join(APP_DIR, "storage", "patient-documents"),
    backupDir: process.env.BACKUP_DIR ?? path.join(APP_DIR, "..", "aura-backups"),
    copyDir: process.env.BACKUP_COPY_DIR || null,
    keepDays: Number(process.env.BACKUP_KEEP_DAYS ?? 30),
    keepMonths: Number(process.env.BACKUP_KEEP_MONTHS ?? 12),
  };
}

/** pg_dump / pg_restore: PG_BIN, then PATH, then the usual Windows install folders. */
export function pgTool(name) {
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  if (process.env.PG_BIN) return path.join(process.env.PG_BIN, exe);
  if (process.platform === "win32") {
    const root = "C:\\Program Files\\PostgreSQL";
    if (existsSync(root)) {
      const versions = readdirSync(root)
        .filter((v) => existsSync(path.join(root, v, "bin", exe)))
        .sort((a, b) => Number(b) - Number(a));
      if (versions.length) return path.join(root, versions[0], "bin", exe);
    }
  }
  return exe;
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error) throw new Error(`${path.basename(command)}: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} failed (${result.status}): ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout;
}

/** Local time as 2026-10-20_0300, which sorts by date and is safe in a file name. */
export function stamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}`;
}

export function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

/**
 * Keeps every dump from the last `keepDays` days and the newest dump of each
 * of the last `keepMonths` months. Hand-made backups (aura-…-before-update)
 * follow the same rules.
 */
export function dumpsToDelete(names, now, keepDays, keepMonths) {
  const dated = names
    .map((name) => ({ name, m: /^aura-(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})/.exec(name) }))
    .filter((d) => d.m)
    .map(({ name, m }) => ({ name, at: new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]), month: `${m[1]}-${m[2]}` }))
    .sort((a, b) => b.at - a.at);
  const keep = new Set();
  const dayLimit = now.getTime() - keepDays * 86_400_000;
  const months = [];
  for (const d of dated) {
    if (d.at.getTime() >= dayLimit) keep.add(d.name);
    if (!months.includes(d.month)) {
      months.push(d.month);
      if (months.length <= keepMonths) keep.add(d.name);
    }
  }
  return dated.filter((d) => !keep.has(d.name)).map((d) => d.name);
}
