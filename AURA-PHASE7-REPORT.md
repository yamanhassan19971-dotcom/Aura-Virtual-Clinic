# AURA Dental PMS — Phase 7 Report

Scope: everything needed to run AURA for real at the clinic: a login for each person with their own password, an Admin page to manage those logins, nightly backups with a tested restore, and a Windows install that starts on boot and is reachable from phones and the iPad. Every mutation is permission-checked and audited in the same transaction; every new string is in English and Arabic.

## 1. Staff accounts

- **Settings → Staff Accounts** (Admin only): every login with role, linked doctor, last sign-in and status (active, must set password, locked, switched off). Add a staff member, edit name/role/doctor link, give a new one-time password, switch an account off or on.
- New accounts and password resets produce a **one-time password** (12 characters, no look-alike letters), shown once. The person must choose their own password (10+ characters) at first sign-in before anything else opens.
- **My account** (click your name in the top bar): your details and a password change.
- An Admin login can be linked to a doctor's diary column, since the owner is also a dentist.
- Guard rails: the clinic always keeps one active Admin; you can't change your own role or switch yourself off; a doctor's column can only have one login.

## 2. Sign-in security

- 5 wrong passwords in a row lock the account for 15 minutes, even for the right password; the login page says so. An Admin's password reset unlocks it.
- Sessions are re-checked against the database on every request. Changing someone's role, resetting their password or switching them off signs them out on every device at their next click (`users.session_version`); the login page explains why.
- Unknown logins take the same time to reject as wrong passwords.
- The demo-accounts hint is hidden in production.

## 3. Backups

`scripts/clinic/backup.mjs` (plain Node, runs on Windows and Linux):

- A full `pg_dump` every night, checked with `pg_restore --list` before it counts as a backup.
- Documents and clinical images copied add-only (never overwritten or deleted).
- 30 days of daily dumps, then the newest of each month for 12 months.
- Optional second copy to an external drive (`BACKUP_COPY_DIR`); a missing drive is reported, not fatal.
- `backup-status.json` drives **Settings → Backups** and a yellow banner for the Admin and Manager when the last backup failed or is over 36 hours old.

`scripts/clinic/restore.mjs` lists backups, and with `--yes` takes a "before-restore" backup, restores the dump, applies newer migrations, and puts back missing documents. Tested end to end: backup of the demo database restored into an empty database gave identical patient, appointment and user counts and all 346 documents.

## 4. Windows install

`scripts/windows/` (Windows PowerShell 5.1, parse-checked; not yet run on Windows):

- `install.cmd` / `install.ps1`: creates the database and `.env` (random secrets, `AUTH_TRUST_HOST=true` so phones can sign in by the laptop's address), installs, builds, runs `db:setup-clinic`, registers the **AURA Clinic App** task (at boot, as SYSTEM, restarts on failure) and the **AURA Daily Backup** task (21:30, catches up if the laptop was off), opens port 3000 on private networks, keeps the laptop awake on AC, takes a first backup.
- `backup-now.cmd`, `restore.ps1`, `update.cmd` (backup, `git pull`, build, restart).
- `docs/CLINIC-INSTALL-AR.md`: the step-by-step guide in Arabic, including phone access on the clinic Wi-Fi and from outside via Tailscale (ZeroTier as fallback).

`db:setup-clinic` now creates the real people: يمان حسن (Admin, linked to Dr Yaman), رغد and حنان (Reception), plus a Doctor login for each other doctor, all with one-time passwords.

The production build was run with that setup and driven from another address on the network: first-password screen, staff page, adding a member, a reset signing a phone session out, the backup banner before the first backup and gone after it.

## 5. Database

One additive migration, `phase7_account_security`: `users.session_version`, `must_change_password`, `failed_logins`, `locked_until`, `last_login_at`. New permission `users.manage` (Admin only).

## 6. Tests

- Unit: `staff-service.test.ts` (11) and `backup-rotation.test.ts` (2); 107 total.
- E2E: Scenario 25 (Admin adds a staff member; first sign-in forces a new password; switching off signs them out) and 25b (lockout message).

## 7. Still to do

- The real install on the clinic laptop, together.
- Whether Tailscale works from Syria (ZeroTier otherwise).
- Complaints with the one-week reply; booking the clinic's 3 cars.
- Clinic data: doctors' full Arabic names, room names, Google review and maps links.
