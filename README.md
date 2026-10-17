# AURA Dental PMS — Phase 1

A dental practice appointment diary: the appointment/patient-flow core of a
larger practice-management system. See `AURA-PHASE1-PROMPT.md` for the full
brief and `AURA-PHASE1-HANDOFF.md` for the build plan; the final report at
the end of this file (or ask the session that built it) covers what shipped.

Later phases each have their own report: `AURA-PHASE2-REPORT.md` (patient
record), `AURA-PHASE3-REPORT.md` (dental chart), `AURA-PHASE4-REPORT.md` (treatment
plans and payments) and `AURA-PHASE5-REPORT.md` (enquiry pipeline, follow-ups, weekly KPIs).

## Stack

Next.js (App Router) · React 19 · TypeScript · Tailwind CSS v4 · PostgreSQL +
Prisma · Auth.js (credentials + argon2) · next-intl (English/Arabic, RTL) ·
dnd-kit · Zod · Vitest · Playwright

## Prerequisites

- Node.js 20+
- PostgreSQL running locally (or reachable via `DATABASE_URL`)

## Setup

```bash
npm install
cp .env.example .env   # then edit DATABASE_URL / AUTH_SECRET if needed
createdb aura_dev       # or: psql -c "CREATE DATABASE aura_dev"
npm run db:migrate      # applies prisma/migrations
npm run db:seed         # seeds a full demo day (4 clinicians, ~44 patients, 60+ appointments)
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/en/login`.

**Demo accounts** (password `Passw0rd!` for all):

| Email | Role |
|---|---|
| `admin@aura.dev` | Admin |
| `manager@aura.dev` | Practice Manager |
| `reception@aura.dev` | Receptionist |
| `yaman@aura.dev` (and `wajih@`, `amr@`, `adham@`, `abeer@aura.dev`) | Clinician |

The demo seed uses AURA's real doctors, opening hours (10:00-20:00, Friday
closed), appointment types and price list (`prisma/aura-clinic-data.ts`), with
made-up patients and six sample treatment plans.

### Going live at the clinic

For the real clinic database, skip `db:seed` and run:

```bash
npm run db:migrate
npm run db:setup-clinic   # AURA practice, doctors, hours, price list, staff logins; NO demo patients
```

It prints each new staff account's one-time password once. Re-running it is
safe: existing accounts and prices edited in Settings are left alone.

## Testing

```bash
npm run test:unit   # Vitest — appointment service (conflict detection, permissions, status transitions)
npm run test:e2e    # Playwright — the 12 end-to-end scenarios, against a dedicated aura_test DB on :3100
```

`test:e2e` spins up its own `next dev` server and reseeds `aura_test` automatically (see
`playwright.config.ts` / `tests/e2e/global-setup.ts`) — it does not touch your `aura_dev` data.

## Project layout

```
prisma/schema.prisma        database schema
prisma/seed.ts               rich demo-data seed (used by `npm run dev`)
prisma/seed-e2e.ts           minimal deterministic seed (used by Playwright)
src/lib/services/            appointment-service.ts is the one place all appointment
                              mutations happen — conflict detection, permission checks,
                              status history and audit log all in one transaction
src/lib/actions/             server actions calling the services, used by client components
src/components/diary/        the diary grid itself
src/components/booking/      new/edit appointment modal, patient search, conflict dialog
src/components/appointment/  side panel, cancel/FTA dialogs
src/components/waiting-room/ waiting room + in-surgery panels
src/components/settings/     clinicians / appointment types / working hours admin
src/i18n/messages/{en,ar}.json  translation catalogs
tests/unit/                  Vitest service-layer tests
tests/e2e/                   Playwright specs, one per scenario in the brief
```
