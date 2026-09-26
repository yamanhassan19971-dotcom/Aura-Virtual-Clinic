# AURA Dental PMS — Phase 2 QA & Regression Report

Scope: full QA pass over the Phase 2 implementation (patient record, medical history, clinical notes, documents, tasks, flags, family linking, duplicate detection, permissions, i18n/RTL, seed data), plus a Phase 1 regression check. Three real bugs were found and fixed during this pass; all are described below with what was done and how it was re-verified.

---

## A. Tests passed

- **Vitest (unit/integration, real Postgres)**: **32/32 passing** — the original 29 (9 Phase 1 + 20 Phase 2) plus 3 new tests added during this QA pass (Practice Manager blocked from authoring medical history; Practice Manager blocked from authoring clinical notes; note-template creation + its audit-log entry).
- **Playwright E2E**: **21/21 passing** — 12 original Phase 1 scenarios (zero regressions) + 9 Phase 2 scenarios, re-run to completion three times over the course of this QA pass (including after each fix).
- **`npx tsc --noEmit`**: clean, no errors.
- **`npx eslint .`**: clean, exit code 0, zero warnings.
- **`npx next build`** (production build): succeeds, zero errors, **zero warnings** (4 build-time warnings about filesystem-tracing were found and fixed — see C.3).
- **Migration integrity**: `prisma validate` passes; both migrations apply cleanly to a brand-new empty database in the correct order; `prisma migrate diff` between that freshly-migrated database and `schema.prisma` reports **no difference**; `aura_dev` and `aura_test` both report "up to date" with no drift.
- **Seed script**: runs cleanly against both an empty database and an already-seeded one (idempotency was itself a bug — see C.2).

## B. Tests failed

None, at the time this report was written. Two failures were observed and resolved during the pass itself (see C.1 and C.2 for what they were and the fix); after fixing, the full suite was re-run and is green.

## C. Bugs found (all fixed)

1. **`createNoteTemplate` never wrote an audit log entry.** Every other Phase 2 mutation (create/update/delete across patients, medical history, alerts, clinical notes, amendments, admin notes, tasks, flags, documents) writes to `AuditLog` inside the same transaction; note-template creation was the one silent exception, found by systematically diffing every exported service function against `writeAudit` calls. **Fixed**: wrapped in a transaction, writes a `patient.noteTemplateCreated` audit row. Covered by a new test.

2. **Seed script's patient `upsert` used an empty `update: {}`.** This meant that once a patient code existed in a database (from any earlier seed run, including runs from before the Phase 2 demographic fields existed), re-running `npx tsx prisma/seed.ts` would never actually update that patient's fields — it silently kept whatever data it had from the very first time it was created. In practice this meant the ARCHIVED/INACTIVE demo patients the seed script is supposed to guarantee (`i < 3` → ARCHIVED, `i < 6` → INACTIVE) **did not actually exist** on the shared `aura_dev` database, because patient codes A00001–A00006 predated that logic. Found by directly querying the database rather than trusting the seed script's own summary output. **Fixed**: the patient upsert's `update` now mirrors `create`, so re-seeding always converges on the documented demo data regardless of prior state. Re-verified: A00001–A00006 are now correctly ARCHIVED/ARCHIVED/ARCHIVED/INACTIVE/INACTIVE/ARCHIVED... (exact assignment is randomized per name but the three ARCHIVED + three INACTIVE guarantee now holds), confirmed via direct query and via the patient list's "Show archived" filter.

3. **Production build emitted 4 warnings** ("Dynamic filesystem access causes tracing of the whole project") from `src/lib/documents/storage.ts`, because the private document storage root is a runtime-computed path that Next's static analyzer can't resolve. Left alone, this risks bundling the entire project (including anything under the repo, not just `public/`) into the server output on a real deploy, which can slow deploys or hit platform size limits. **Fixed**: added `turbopackIgnore` comments on the four flagged calls, since this filesystem access is intentionally dynamic and can never be statically scoped further than it already is. Build is now warning-free.

4. **A non-deterministic E2E test** (`18b`, booking from the diary then from the patient record, checking both appointments show up together) relied on two independent `new Date()` calls — one when the diary loads, one when a second booking modal's date field defaults — implicitly agreeing on "today." This is normally invisible, but the sandbox's clock happened to sit within a few seconds of a UTC midnight rollover during this QA session, so the two calls landed on different calendar days and the test failed with "expected 2 appointments, found 1" (the first appointment silently landed on tomorrow, not today). Root-caused by querying the appointments table directly rather than trusting the UI snapshot alone, and by confirming the system clock had in fact crossed midnight mid-run. **This is not a product bug** — the app's own date-handling is correct and consistent (local time throughout, no UTC/local mismatch) — it was purely a fragile test. **Fixed**: the test now reads the diary's displayed date once and explicitly pins both bookings and the final verification to that same date, making it correct regardless of wall-clock timing. Re-verified stable across multiple fresh runs.

## D. Phase 1 regressions

**None found.** Specifically checked and confirmed working exactly as before:
- Diary rendering, multi-practitioner columns, time-scale switching, drag/resize, gap visibility, "Jump to now."
- Full appointment status workflow (Pending → Confirmed → Arrived → In Surgery → Completed, plus Cancel/FTA) with the status-history audit trail visible and correct in the side panel.
- Waiting Room and In Surgery mini-panels.
- Patient quick-search and quick-add-patient flow from the booking modal.
- Settings (Clinicians / Appointment Types / Working Hours).
- Arabic/English switching and RTL layout on the diary itself.
- All 12 original Playwright scenarios pass unmodified.

## E. Phase 2 issues (beyond the bugs already fixed in C)

None found that rise to "bug" — see G for lower-priority incompleteness/judgment calls instead. The core Phase 2 feature set (patient record header + 8 tabs, versioned medical history, clinical note lock/amendment, documents with byte-sniffed validation, tasks, flags, family linking with reciprocal display, duplicate detection, all 5 entry points, book-from-record, i18n/RTL) was re-verified end to end and holds up, including under roles it hadn't been visually checked under before this pass (Practice Manager: confirmed via screenshot that clinical data is fully visible but no "New Medical History," "+ Add Alert," or "Add Clinical Note" controls are rendered, and the two clinical quick-actions are absent from the header).

## F. Security / data-integrity concerns

One real gap was found and fixed in the previous session and **re-verified as still fixed** here: Receptionist could see clinical data (medical alerts, medical history, clinical notes) via the Overview tab or by navigating directly to `/medical` or `/history` URLs, despite the role having no clinical permission. Re-confirmed fixed at all three layers (page-level `notFound()`, tab not rendered as a link, alert data never passed into the header component's props for that role) and additionally confirmed no server action exposes the underlying queries directly (the only callers are the two now-guarded page components).

Systematically re-audited during this pass and found clean:
- **Cross-practice isolation**: every Phase 2 service mutation that operates on a bare ID (task, flag, document, alert, clinical note, amendment) re-verifies the underlying record's practice via a direct column or a joined `patient.practiceId` check before mutating — confirmed by reading every such function, not just the ones with an obvious `practiceId` parameter.
- **Duplicate-detection query** is practice-scoped; can't be used to probe for patients in another practice.
- **`updatePatientDetails`**'s dynamic field-diff builder can only ever contain keys from the Zod-validated schema (Zod strips unrecognized keys), so despite being typed as `Prisma.PatientUncheckedUpdateInput` (which technically exposes `practiceId`/`status` at the type level), there is no runtime path for a client to inject those fields.
- **`/api/documents/[documentId]`**: re-checks session, permission, and practice ownership (via a join) on every request; soft-deleted documents 404; filenames are percent-encoded in `Content-Disposition`; `Cache-Control: private, no-store`.
- **Document storage**: filenames sanitized to `[a-zA-Z0-9._-]` before being placed in a path (blocks path traversal via a crafted upload filename); `readDocumentFile` independently verifies the resolved path still starts with the storage root before reading.
- **Audit log**: a document's internal `storageKey` (filesystem path) is deliberately excluded from what gets written to `AuditLog`, so the audit trail never leaks internal storage paths.
- **Archive vs. edit permission split**: setting a patient to `ARCHIVED` requires `patients.archive`; every other status transition only requires `patients.editDemographics` — matches the documented role table exactly.

Nothing rated higher than the items already listed above; no SQL injection surface (Prisma throughout, no raw queries), no secrets or plaintext credentials found in logs or audit rows.

## G. Things that are incomplete or only partially implemented

These are pre-existing judgment calls (already flagged in the Phase 2 final report) rather than new findings, restated here for completeness:

- **Medical alerts are hidden from Receptionist entirely**, including in contexts (like the header banner) where some real-world practices would want front-desk staff to see a safety-critical allergy warning even without full chart access. Defensible either way; flagged for a product decision before Phase 3, not changed unilaterally.
- **Document access is not further split by category.** Receptionist can view/upload all document categories (including `RADIOGRAPH`/`CLINICAL_PHOTOGRAPH`), not just administrative ones — treated as one "Documents" feature area distinct from Medical/Clinical History, consistent with `patients.manageDocuments: true` for that role. Worth confirming this is the intended boundary before Phase 3 adds more clinical imaging.
- **The "Reactivate Patient" button is gated behind `patients.archive`**, the same permission as archiving — meaning Receptionist (who has `editDemographics` but not `archive`) cannot reactivate a patient through the UI even though the server-side `setPatientStatus` logic would technically permit it for non-archive transitions. Minor UI/permission asymmetry, not a security issue (fails toward being more restrictive, not less); worth a decision on which behavior is intended.
- **No pagination on `/patients`** — fine at the current ~70 seeded patients, will need addressing before real practice volumes.
- **Document previews are limited to PDF/PNG/JPEG** (the only types the byte-sniffer currently recognizes); everything else is download-only, by design.
- **The clinical-note create flow's `router.refresh()`** could theoretically race a sign/amend performed in the same second immediately after it (see the Phase 2 final report); not observed as a real defect, only as E2E timing sensitivity that was worked around in the test rather than the app.

## H. Recommended fixes

All fixes identified as necessary during this QA pass have already been applied, tested, and pushed (see commit `26b71dc`). Recommended follow-ups, none blocking:

1. Get an explicit product decision on the two G-list permission judgment calls (alerts-in-header visibility for Receptionist; document-category access split) before Phase 3 builds more clinical-imaging features on top of the document system.
2. Either loosen the "Reactivate" button's gating to `patients.editDemographics` (matching what the server already allows) or leave it as-is deliberately — currently it's an accidental-looking asymmetry rather than a decided one.
3. Add pagination to `/patients` before real deployment.
4. Consider a short note in the E2E test suite's README/comments that any test spanning multiple `new Date()`-dependent UI defaults should pin the date explicitly (the pattern now used in scenario 18b) — this class of flake can recur in any future date-crossing test if the pattern isn't followed.

---

## PHASE 2 STATUS: **READY**

All automated checks are green (32/32 unit, 21/21 E2E, clean typecheck/lint/build), the database schema and migrations are consistent and drift-free, Phase 1 functionality is unchanged and fully regression-tested, and the three real defects found during this pass (a missing audit-log entry, a seed script that silently failed to demonstrate the archived/inactive patient scenario, and four build warnings) have been fixed, tested, and are pushed to `claude/aura-dental-pms-phase1-9gtcv9` (commit `26b71dc`). The permission boundary between Receptionist and clinical staff — the single most safety-critical rule in the Phase 2 spec — was independently re-verified at the page, UI, and server-action level and holds.

The items in section G are real but are scope/judgment calls, not defects — they don't block calling Phase 2 stable, but are worth a quick decision before Phase 3 builds on top of them.
