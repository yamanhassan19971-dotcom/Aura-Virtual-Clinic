# AURA Dental PMS — Phase 3 Final Report

Scope: a professional, data-driven dental clinical chart (odontogram) and clinical charting foundation, added to the existing Phase 1 (appointment diary) and Phase 2 (patient record) system without rebuilding either. Every new mutation is permission-checked server-side and audited; every new UI string goes through the existing English/Arabic i18n system.

---

## 1. What was built

A **Patient → Chart** experience with three sections (segmented control, no separate routes needed):

- **Odontogram** — permanent, deciduous, and mixed dentition views of a professional, click-driven tooth chart (upper/lower arches, FDI numbering, 5-surface mini-grid per tooth: Mesial/Distal/Occlusal*/Buccal/Lingual, *occlusal only shown for premolars/molars). Clicking a tooth number selects the whole tooth; clicking a surface cell selects that surface. Selecting a tooth opens a detail panel to chart new findings, view current findings, and view that tooth's full history.
- **Chart History** — a filterable (tooth, practitioner, finding type, status) table of every chart entry ever recorded for the patient, including retracted ones (shown dimmed, never deleted).
- **BPE** — a simple six-sextant Basic Periodontal Examination form and a history of previous exams.

Plus a new top-level **Images** tab (clinical images/radiographs, separate from the general Documents tab) and an **Open Chart** header quick action.

Visual states on the odontogram: navy fill = existing/base condition, green fill = completed treatment, a blue "P" badge = a planned treatment pending, grey with a diagonal strike = missing tooth. Colors reuse the app's existing CSS variables — no new palette introduced.

## 2. Database changes

One migration, `20260927040706_phase3_dental_chart`, additive only — no existing Phase 1/2 table was altered or dropped:

- **`ChartEntry`** — the core structured record: `patientId`, `toothNumber` (FDI string), `dentitionType` (derived from the tooth number and stored for indexed filtering), `surface` (nullable — null means whole-tooth), `itemCode` (a code-defined vocabulary key, see below), `status` (`EXISTING` / `PLANNED` / `COMPLETED`), `recordedDate`, `practitionerId`, `appointmentId`, `note`, plus `active`/`resolvedAt`/`resolvedById` for soft-retraction (mirrors the existing `MedicalAlert` active/resolved pattern) and `completedAt` for the planned→completed transition. Rows are never deleted or overwritten in place — every change is an audited update to the same row, so a tooth's full history is always reconstructable.
- **`BpeExam`** + **`BpeSextantScore`** — one exam header row per BPE recording, six child score rows (`sextant` enum, `code` "0"-"4" or "*" for furcation).
- **`ClinicalImage`** — a separate model from `PatientDocument` (not a reuse of it), because it's gated by `patients.viewClinical`/`manageClinicalImages` rather than `patients.manageDocuments`, and can optionally link to a tooth or a specific `ChartEntry`. Reuses the exact same private file-storage abstraction (`lib/documents/storage.ts`) and soft-delete pattern as documents.
- **`ClinicalNote`** (existing Phase 2 model) — extended with two new nullable columns, `toothNumber` and `chartEntryId`, so a clinical note can optionally be tied to the tooth it was written about. Every existing Phase 2 note (and any Phase 3 note not tied to a tooth) is completely unaffected — this is why Phase 3 needed **no new note/amendment/signing tables**: it reuses the existing `ClinicalNote`/`ClinicalNoteAmendment` draft→signed→amended engine exactly as it stood.

No new tables were created for tooth identity (a `Tooth` table) or the finding vocabulary. Teeth are a fixed, standardized domain (52 FDI codes) rather than patient data, so they live in a TypeScript reference module (`lib/dental/teeth.ts`) instead of a database row. The finding/treatment vocabulary (filling, crown, bridge, implant, root canal, missing, denture, veneer, other) follows the exact same code-defined-catalog pattern the codebase already uses for medical-history question keys and patient-flag keys (`lib/dental/chart-item-catalog.ts`) — a string key validated against a catalog, not a hard-coded switch statement in React, and expandable in Phase 4 without a migration.

Migration integrity verified: `prisma validate` passes; all three migrations (Phase 1, Phase 2, Phase 3) apply cleanly and in order to a brand-new empty database; `prisma migrate diff` between that freshly-migrated database and `schema.prisma` reports **no difference**; `aura_dev` reports "up to date."

## 3. UI changes

- `PatientTabs`: `Chart` and `Images` are now real, permission-gated tabs (previously `Chart` was a disabled "coming soon" placeholder). `TreatmentPlans`/`Account` remain placeholders, explicitly deferred to Phase 4.
- `PatientHeaderBar`: a new "Open Chart" quick action (view-gated, so a Practice Manager can navigate in to look, matching the existing "can view, not author" rule).
- New components under `components/patient/chart/`: `Odontogram`, `ToothDetailPanel`, `ChartEntryModal`, `ToothNoteModal`, `ChartHistoryList`, `BpeSection`, `ChartPanel` (the page-level composer).
- New `components/patient/images/ImagesPanel.tsx`, structurally mirroring the existing `DocumentsPanel` (upload modal, category select, preview, download, soft-delete) but pointed at `ClinicalImage`/`/api/clinical-images/[id]` instead of `PatientDocument`/`/api/documents/[id]`.
- No existing Phase 1 or Phase 2 component was rewritten — only `PatientTabs.tsx` and `PatientHeaderBar.tsx` were extended, and `ClinicalHistoryPanel`/`clinical-note-service.ts` gained the two optional tooth fields already described above.

## 4. New clinical chart functionality

- View permanent / deciduous / mixed dentition without duplicating data — dentition mode is a pure display filter; the underlying tooth identity (FDI code) never changes.
- Chart a whole-tooth finding or a specific-surface finding (Mesial/Distal/Occlusal/Buccal/Lingual), explicitly distinguished in the data model (`surface: null` vs a surface value) — a tooth's MOD filling is stored as three separate surface rows, not a single "46 = filling" fact.
- Mark a tooth missing (`itemCode = "MISSING"`) — never deletes anything; recorded exactly like any other chart entry, with a dedicated `chart.toothMarkedMissing` audit action.
- Distinguish base/existing condition, planned treatment, and completed treatment via `status`. A planned entry becomes completed through an explicit, audited "Mark Completed" action (only valid from `PLANNED`; attempting it from any other status is rejected).
- Retract (soft-remove) any entry without deleting it — it disappears from "current" views but remains in history, timestamped and attributed.
- Tooth-specific history (chart entries **and** tooth-linked clinical notes, merged chronologically) available the moment a tooth is selected — no need to search the whole patient history.
- Patient-wide Chart History with tooth/practitioner/finding-type/status filters.
- BPE: create an exam (all six sextants), view previous exams with date and practitioner.
- Clinical images/radiographs: upload, categorize (intraoral/extraoral/radiograph/other), optionally tag with a tooth number, preview, download, soft-delete.

## 5. New patient record functionality

- Two new tabs (`Chart`, `Images`) in the existing patient-record tab bar.
- A new "Open Chart" header quick action.
- Clinical notes can now optionally carry a `toothNumber`, so a note written from the Chart flows into both the tooth's own history and the existing Clinical History tab — the two views were deliberately kept separate (dental treatment history vs. narrative notes history), matching how the referenced Dentally workflow separates its Chart tab from its Clinical Notes/History tab.

## 6. New permissions

Three new permissions, following the exact existing pattern (`ADMIN`/`CLINICIAN` = true, `PRACTICE_MANAGER`/`RECEPTIONIST` = false, all gated for *visibility* by the existing `patients.viewClinical`):

- `patients.manageClinicalChart` — chart entries (create/complete/retract).
- `patients.manageBpe` — BPE exams.
- `patients.manageClinicalImages` — clinical image upload/delete.

This means: a Receptionist cannot see the Chart/Images tabs at all (server-side `notFound()`, not just a hidden button — verified by direct URL navigation returning 404). A Practice Manager can see and navigate the Chart/Images tabs (oversight, matching how they can already view medical history and clinical notes) but every authoring control (`+ Add Finding`, `+ Add Note`, `Save BPE Exam`, `Upload Image`) is absent, and the underlying server actions independently re-check the permission — the UI hiding is a convenience, not the enforcement boundary. This directly resolves a note the Phase 2 QA report flagged ("worth confirming this is the intended clinical-imaging boundary before Phase 3") by giving clinical images their own permission, separate from general document management.

## 7. New audit functionality

Every meaningful chart mutation writes an `AuditLog` row inside the same transaction as the mutation (the existing `writeAudit` helper, unchanged): `chart.entryCreated`, `chart.toothMarkedMissing` (a distinct action so "tooth marked missing" is directly searchable rather than buried among generic entries), `chart.entryCompleted`, `chart.entryRetracted`, `chart.bpeCreated`, `chart.imageUploaded`, `chart.imageDeleted`. As with the Phase 2 pattern, a `ClinicalImage`'s internal `storageKey` is deliberately excluded from what gets written to the audit trail.

## 8. New seed/demo data

Eight dedicated demo patients (fixed patient codes `P30001`-`P30008`, re-seeding always converges on the same state — same idempotent `update: data / create: data` upsert pattern used to fix the Phase 2 seed staleness bug):

| Code | Name | Scenario |
|---|---|---|
| P30001 | Noor Khalil | Healthy / mostly unremarkable chart |
| P30002 | Bilal Youssef | Multiple restorations across several teeth/surfaces |
| P30003 | Widad Saleh | Missing teeth (historic extractions) |
| P30004 | Diana Haddad | Existing crown following root canal treatment |
| P30005 | Yara Suleiman | Mixed dentition (young patient, deciduous + permanent charted) |
| P30006 | Fadi Mansour | Several planned treatments (crown, filling, veneer, planned extraction) |
| P30007 | Ghina Nasser | BPE history (two exams over time) |
| P30008 | Hadi Aziz | Clinical images/radiographs |

## 9. Tests executed

- **Vitest (unit/integration, real Postgres)**: 3 new files — `chart-service.test.ts`, `bpe-service.test.ts`, `clinical-image-service.test.ts` — covering permission blocks (Receptionist, Practice Manager), FDI validation, whole-tooth vs. surface charting, the missing-tooth audit action, planned→completed transition rules (including rejecting completion from a non-planned status), cross-practice isolation, retraction without deletion, tooth-history aggregation of entries + notes, BPE duplicate-sextant rejection, byte-signature validation on image upload, and audit-trail content (including that `storageKey` never leaks into the audit log).
- **Playwright E2E**: 1 new file, `21-dental-chart.spec.ts`, 6 scenarios covering the full brief-mandated workflow: opening the Chart, switching permanent/deciduous/mixed dentition, selecting a tooth (via both the whole-tooth button and a direct surface click), charting a whole-tooth finding and a surface finding, marking a tooth missing, charting and then completing a planned treatment, tooth history, adding a tooth-linked clinical note and then signing + amending it from the existing Clinical History tab, BPE exam creation, clinical image upload, Receptionist/Practice-Manager permission boundaries, Arabic RTL, direct audit-log verification, and a final return-to-diary check.
- **Full regression**: the complete pre-existing Phase 1 + Phase 2 suites (21 scenarios) re-run alongside the new ones.
- **Quality gates**: `npx tsc --noEmit`, `npm run lint`, `npm run test:unit`, `npx playwright test` (full suite), `npx next build`, plus a from-scratch migration/diff check against a brand-new database.

## 10. Tests passed

- **Vitest**: **52/52** (32 pre-existing, unchanged + 20 new: 10 chart-service, 5 BPE, 5 clinical-image; the tooth-linked-note extension to `ClinicalNote` is exercised end-to-end by `chart-service.test.ts`'s tooth-history test rather than needing a separate file).
- **Playwright E2E**: **27/27** (21 pre-existing Phase 1/2, zero regressions + 6 new Phase 3 scenarios).
- **`npx tsc --noEmit`**: clean.
- **`npm run lint`**: clean, zero warnings.
- **`npx next build`**: succeeds, zero errors, zero warnings; new routes (`/patients/[patientId]/chart`, `/patients/[patientId]/images`, `/api/clinical-images/[imageId]`) all present as dynamic server routes.
- **Migration integrity**: `prisma validate` passes; fresh-database migration + `prisma migrate diff` reports no difference; `aura_dev` up to date.
- **Seed idempotency**: re-running `npx tsx prisma/seed.ts` twice produces the same 26 chart entries / 2 BPE exams / 2 clinical images for the demo patients both times.

## 11. Known issues

- A recurring **non-blocking** browser console message, `unhandledRejection: Error: An unexpected response was received from the server`, appears in the Next.js *dev server's* terminal output during Playwright runs — but it already appears on several pre-existing Phase 1/2 spec files too (confirmed by running them in isolation before and after this work), so it is not a Phase 3 regression. It never causes a test assertion to fail, and it did not appear at all during manual testing against a production build (`next build && next start`) with realistic click pacing — it appears to be a `next dev`-only artifact of a superseded background RSC fetch (e.g. a `router.refresh()` call overlapping a fast subsequent navigation), consistent with Playwright's E2E suite clicking through flows faster than a real user would. Not treated as a defect; flagged for awareness.
- The odontogram's tooth-number click target and surface cells are intentionally compact (professional-density chart, not a phone-first design, per the brief's desktop-priority instruction) — usable on a tablet but tightest on very small viewports; no phone-specific layout was built, matching the brief's explicit instruction not to sacrifice desktop usability for phone width.

## 12. Deferred features (explicitly out of Phase 3 scope, per the brief)

Full treatment-plan engine and workflow, charging/invoicing, payment processing, NHS claiming, any AI features (clinical assistant, diagnosis, radiograph analysis, clinical notes, dictation/voice transcription), advanced periodontal charting (pocket depths, recession, bleeding, mobility, furcation, plaque), advanced imaging AI, patient portal, WhatsApp automation, advanced recall automation, additional tooth-numbering systems (Universal/Palmer) beyond FDI, and a Settings-page UI for editing the chart-item vocabulary (it's currently a code-defined catalog, matching the existing question-catalog/flag-catalog pattern, and is designed to be trivially expandable in Phase 4).

## 13. Recommended improvements (non-blocking, for a future phase)

1. Phase 4's treatment-plan engine can build directly on `ChartEntry.status = PLANNED` rows — the data model was designed with this in mind (see schema.prisma comments).
2. Consider promoting the chart-item vocabulary from a code-defined catalog to an admin-editable table (mirroring `AppointmentType`) once Phase 4 needs practice-specific customization of the finding list.
3. Add pagination/virtualization to the Chart History table before a patient accumulates hundreds of entries (the Phase 2 QA report flagged the same need for `/patients`; same principle applies here — not urgent at current demo volumes).
4. Consider image thumbnails for the Images tab once real (larger) radiograph files are in use, rather than fetching full-size images for the list view.

## 14. Git

Branch: `claude/aura-dental-pms-phase1-9gtcv9`. Phase 3 completion commit: **see the commit immediately following this report in the branch history** (this file is committed together with all Phase 3 code in a single commit).

## 15. Phase 1 and Phase 2 regression confirmation

**Confirmed passing, unchanged.** All 21 pre-existing Playwright scenarios (appointment diary, drag/resize, full status workflow, patient search/details, duplicate detection, medical history versioning, clinical note lifecycle, documents/tasks, family linking, receptionist clinical-access blocking, Arabic RTL) pass exactly as before. All 32 pre-existing Vitest tests pass unchanged. No Phase 1 or Phase 2 file was rewritten; the only touched pre-existing files were `PatientTabs.tsx`, `PatientHeaderBar.tsx` (both additive), `clinical-note-service.ts`/`clinical-note.ts` validation (two new optional fields), `patient-queries.ts` (new query functions appended), `permissions.ts` (three new permission keys appended), and the two seed scripts (additive blocks appended, existing logic untouched).

---

## PHASE 3 READY
