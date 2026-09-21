# AURA Dental PMS: Phase 1 Handoff

Save this file in the repo root next to `AURA-PHASE1-PROMPT.md` (the full original prompt). Read both before writing code.

## Kickoff message to paste into Claude Code

> Read AURA-PHASE1-HANDOFF.md and AURA-PHASE1-PROMPT.md. Inspect the repo first. If a reasonable stack already exists, keep it and adapt the plan. If the repo is empty, use the stack below. Give me a concise plan, then build Phase 1 in the order listed, running real tests. Don't stop for small decisions; stop only for major architecture choices.

## Stack (use only if the repo is empty)

- Next.js (App Router), React, TypeScript, Tailwind
- PostgreSQL + Prisma (migrations and seed script)
- Auth.js sessions, argon2 password hashing
- next-intl with `/i18n/en` and `/i18n/ar`; CSS logical properties (`ms-`, `ps-`, `start`/`end`) and `dir` switching so RTL is built in, not bolted on
- dnd-kit for drag and resize, with optimistic updates
- Zod validation on every API input
- Vitest for service-layer tests, Playwright for the 12 scenarios

## Architecture decisions already made

1. **Multi-location ready:** every appointment, room and practitioner carries `practice_id`.
2. **Future-proof links:** `patient_id` on appointments is the hook for later clinical notes, charting, treatment plans, invoices, payments and recalls. Do not add temporary structures.
3. **One server-side appointment service** owns all mutations: create, edit, move, resize, status change, cancel, FTA. It runs conflict detection, permission checks, and writes `appointment_status_history` and `audit_log` in the **same transaction**.
4. **Conflict override** is allowed only for Admin and Practice Manager, and the override is stored (flag plus who and why).
5. **Never delete appointments.** Cancel and FTA are statuses with a stored reason and timestamp.
6. **Timestamps stored:** `arrived_at`, `in_surgery_at`, `completed_at`, `cancelled_at`, `fta_at`, so waiting time and chair time can be derived later.
7. **Permissions:** role → permission map (Admin, Practice Manager, Receptionist, Clinician), enforced in the API layer, not just the UI.
8. **Security:** no patient data in URLs (use opaque IDs), no sensitive data in console logs, synthetic demo patients only.

## Tables

`practices`, `rooms`, `users`, `practitioners`, `patients`, `appointment_types`, `appointments`, `appointment_status_history`, `audit_log`

Appointment fields: see section 37 of the original prompt.

## Build order

1. Schema, migrations, seed (4 clinicians, 4 surgeries, about 40 patients, 40+ appointments covering every status and type)
2. App shell: sidebar, language switcher, EN/AR with RTL
3. Diary grid: time axis vertical, clinicians as columns, cards positioned by start and duration, 5/10/15/30-minute scale, working-hours shading, NOW line, Jump to Now, gap visibility
4. Booking form, patient search, and quick new patient
5. Status workflow, side panel, quick actions, FTA and cancel dialogs
6. Waiting Room and In Surgery panels, plus today's summary strip with status filters
7. Drag and drop and resize, with confirmation and conflict warnings
8. Settings: clinicians, appointment types, working hours
9. Tests: the 12 scenarios from the prompt, run for real
10. Polish, then report

## Diary implementation notes

- Position cards with CSS grid or absolute placement from `(start - dayStart) / slotMinutes * slotHeight`.
- Snap drag and resize to the current slot scale.
- The diary must be excellent at 1440x900 and 1920x1080. Tablet should not break.
- Never rely on colour alone: each status gets text plus an icon.
- Keyboard shortcuts: <- previous day, -> next day, T today.

## Final report (required)

1. What was built
2. Files and components
3. Database schema
4. How to run
5. Test results
6. Known limitations
7. Suggested Phase 2 (patient records, clinical notes, dental charting, treatment planning)

## Out of scope

Clinical chart, perio chart, treatment plans, invoices, payments, NHS claims, AI, X-rays, patient portal, online booking, WhatsApp, email automation, advanced reporting, inventory, lab management. Placeholder nav items only.

## Note on AURA-PHASE1-PROMPT.md

The full original prompt (57 sections, including the exact appointment field list in section 37, the 12 named test scenarios in section 52, and the visual/status/palette spec) was supplied mid-build and saved alongside this file. It is the authoritative spec; where it's more specific than this handoff (e.g. the 7-status list including "Confirmed", the exact colour palette, the sidebar item list), the prompt file wins.
