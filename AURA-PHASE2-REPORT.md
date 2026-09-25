# AURA Dental PMS — Phase 2 Final Report

Patient Record, Patient Management & Clinical Record Foundation, built on top of Phase 1's appointment diary without modifying its behavior.

## 1. What was built

- **Patient record**: a persistent header (name, ID, age, DOB, phone, email, status badge, medical-alert badges, flag badges, quick actions, "Back to Diary", current-appointment banner) plus 8 working tabs — Overview, Details, Medical, Appointments, Clinical History, Notes, Documents, Tasks — and 3 greyed-out future tabs (Chart, Treatment Plans, Account).
- **5 entry points wired into the record**: diary-card hover icon, the appointment side panel's "Open Patient" link, the Waiting Room and In Surgery panel rows, and the real `/patients` search/list page.
- **Versioned medical history**: every submission creates a new `CURRENT` row and flips the previous one to `PREVIOUS` — never overwritten. Flagged answers raise a `MedicalAlert`, shown as a badge in the header; alerts are soft-resolved, never deleted.
- **Clinical notes with a real lock**: Draft → Signed → Amendment. A signed note's `content` is frozen at the database layer (`RecordLockedError`); corrections only ever go through an append-only `ClinicalNoteAmendment`. Practice-wide and personal note templates.
- **Non-clinical patient notes**, kept in a separate model/UI from clinical notes so the two are never mixed.
- **Document upload** validated by sniffing the file's actual bytes (magic numbers for PDF/PNG/JPEG), not the browser-supplied MIME type or extension — rejects a renamed executable. Files are stored outside `public/` and served through an authenticated route that re-checks session, practice, and permission on every request.
- **Patient tasks** and **configurable flags** (VIP, High Anxiety, Interpreter Required, etc.).
- **Family linking** by real patient ID (no duplicated demographic data), with the reciprocal relationship computed and displayed on both records, and unlink support.
- **Duplicate-patient detection** on creation (name + DOB + phone heuristic), with a dialog mirroring Phase 1's `ConflictDialog` pattern — shows the possible match with a link to open it, or an explicit "Create Anyway" override.
- **Role permissions extended**: Receptionist has full demographic/administrative access but **no clinical access** — enforced at the page level (direct URL navigation 404s), not just hidden buttons. Practice Manager can view clinical data but not author it. Clinician/Admin have full clinical access.
- **"Book Appointment" from the patient record** reuses Phase 1's exact `BookingModal` and `appointment-service` via a new `initialPatient` prop — no second booking system. Verified end-to-end: an appointment booked from a patient record appears in both the record's Appointments tab and the Phase 1 diary.
- **Full EN/AR i18n** for every new string, professional Arabic dental/clinical terminology, and RTL verified across all 8 tabs, the patient list, and the duplicate dialog.
- **Audit logging** extended to every Phase 2 mutation using Phase 1's existing generic `AuditLog` table (no schema change needed there) via a shared `writeAudit()` helper.
- **Seed data** expanded from 44 to 70 patients with realistic Phase 2 demographics, ~10 family clusters, medical histories/alerts for ~70% of patients, 1–2 clinical notes (draft/signed/amended mix) for ~55%, admin notes for ~30%, documents for ~20%, tasks for ~25%, flags for ~15% — while leaving Phase 1's appointment seeding untouched.

**Explicitly not built** (per spec): odontogram/dental chart, periodontal chart/BPE, treatment plans, invoicing/payments, NHS claims, WhatsApp/SMS, patient portal, online booking, AI, inventory, lab management.

## 2. Database changes

One migration: `prisma/migrations/20260925191816_phase2_patient_record/`. Applied to both `aura_dev` and the `aura_test` Vitest/Playwright database. Fully backward compatible — every new `Patient` column is nullable or defaulted, and the Phase 1 seed still runs unmodified against the new schema.

New enums: `PatientStatus`, `PatientContactMethod`, `FamilyRelationType`, `MedicalHistoryStatus`, `MedicalAnswerValue`, `ClinicalNoteStatus`, `DocumentCategory`, `TaskStatus`.

New models: `PatientFamilyRelationship`, `MedicalHistory` + `MedicalHistoryAnswer`, `MedicalAlert`, `ClinicalNoteTemplate`, `ClinicalNote` + `ClinicalNoteAmendment`, `PatientNote`, `PatientDocument`, `PatientTask`, `PatientFlag`.

`Patient` extended with ~20 new columns (middle/preferred name, title, gender, preferred language, home/work phone, full address, emergency contact, preferred practitioner, acquisition source, preferred contact method, recall preference, `createdBy`/`updatedBy`). `User`, `Practice`, `Practitioner`, and `Appointment` all gained the corresponding back-relations.

Medical questions (`src/lib/medical/question-catalog.ts`) and patient flags (`src/lib/patients/flag-catalog.ts`) are **code-defined catalogs**, not database tables — the question/flag set can grow without a migration, while `MedicalHistoryAnswer` stores the catalog key generically (`category`/`questionKey`/`answer`/`freeText`). This was a deliberate scope decision per the spec's "don't blindly create every table" instruction.

## 3. New routes and components

```
/patients                                    real search/list page + duplicate-detection dialog
/patients/[patientId]                        redirects to .../overview
/patients/[patientId]/overview               6-card summary (clinical cards hidden for Receptionist)
/patients/[patientId]/details                demographics, edit, family linking
/patients/[patientId]/medical                alerts + versioned history list + new-history form
/patients/[patientId]/appointments           upcoming/past, book-from-record
/patients/[patientId]/history                clinical notes: create/sign/amend, templates, search/filter
/patients/[patientId]/notes                  administrative notes
/patients/[patientId]/documents              upload/preview/download/delete
/patients/[patientId]/tasks                  create + status transitions
/api/documents/[documentId]                  authenticated file download/preview
```

~35 new components under `src/components/patient/`, `src/components/booking/DuplicatePatientDialog.tsx`, plus new service/action/validation modules under `src/lib/{services,actions,validation}/` (patient, medical, clinical-note, patient-record) and `src/lib/documents/storage.ts`.

## 4. New permissions

Added to the `Permission` union in `src/lib/permissions.ts`: `patients.editDemographics`, `patients.viewClinical`, `patients.manageMedicalHistory`, `patients.manageAlerts`, `patients.manageClinicalNotes`, `patients.manageNoteTemplates`, `patients.manageAdminNotes`, `patients.manageDocuments`, `patients.manageTasks`, `patients.manageFamily`, `patients.manageFlags`, `patients.archive`.

| Role | Demographics | Clinical (view) | Clinical (author) | Admin notes / docs / tasks / flags |
|---|---|---|---|---|
| Admin | ✅ | ✅ | ✅ | ✅ |
| Practice Manager | ✅ | ✅ | ❌ | ✅ |
| Receptionist | ✅ | ❌ | ❌ | ✅ |
| Clinician | ✅ | ✅ | ✅ | ✅ |

**A real gap found and fixed during testing**: the Medical and Clinical History pages, the Overview tab's clinical cards, and the header's medical-alert badges were not actually checking `patients.viewClinical` — a Receptionist could see full clinical data by navigating directly to `/patients/[id]/medical` or simply opening the Overview tab. Fixed at three layers: (1) the two clinical tab pages now call `notFound()` server-side for a role without `viewClinical`; (2) `PatientTabs` never renders them as clickable links for that role; (3) the layout only passes `header.alerts` into the header's client component when the viewer can see clinical data, so the raw alert labels never reach that component's props for a Receptionist — not merely hidden after the fact. Covered by `tests/e2e/19-receptionist-blocked-from-clinical.spec.ts`.

## 5. Tests performed

- **Vitest (service layer, real Postgres)**: 29/29 passing — 9 from Phase 1 (unmodified, still green after the schema extension and the shared `writeAudit`/`encodeReason` refactor) + 20 new (patient CRUD/duplicate/archive/family, medical history versioning + alerts, clinical note draft→sign→amend + lock enforcement, patient notes/tasks/flags/documents including a rejected fake-`.pdf`).
- **Playwright (E2E, dedicated `aura_test` DB)**: 21/21 passing — the original 12 Phase 1 scenarios (unmodified, confirmed zero regressions) + 9 new Phase 2 scenarios covering: patient search → details edit → reload persistence; duplicate detection with override; medical history versioning + alert badge; clinical note draft → sign (frozen) → amendment; document upload + task status transitions; family link shown reciprocally on both records; diary-card → patient record → book-from-record round-tripping back to the diary; Receptionist blocked from all clinical data (UI and direct URL); and Arabic RTL ⇄ English LTR across the whole record.
- **Manual verification** (screenshots taken throughout): all 8 tabs in both English and Arabic, the duplicate dialog, the seeded family/medical/clinical data for a real patient, and the permission fix from both the Admin and Receptionist accounts.
- `npx tsc --noEmit` clean at every checkpoint.

## 6. Known limitations / judgment calls

- **Medical alerts in the header are now hidden from Receptionist** to match the spec's explicit "no clinical access" rule. Many real dental PMS products deliberately surface safety-critical alerts (e.g. drug allergies) to front-desk staff; this is a defensible product decision either way — flagged here for Phase 3 to confirm rather than silently assumed.
- The clinical-note create flow's `router.refresh()` (used to pick up side effects) can theoretically race a sign/amend performed in the same second immediately after; not observed in manual use, only surfaced as E2E timing sensitivity. Low risk at human interaction speed; worth a proper optimistic-state-merge pass if it's ever seen in production.
- Document previews only cover PDF/PNG/JPEG (the only types the byte-sniffer accepts); anything else falls back to download-only.
- No pagination on `/patients` yet (fine at 70 seed patients; will need it well before real practice volumes).
- The DOB rendering via `Intl.DateTimeFormat(locale)` inside an RTL Arabic paragraph can visually reorder digits in some browsers — this is the same formatting call already used in Phase 1 and elsewhere in Phase 2 for consistency; not something newly introduced, but worth a `<bdi>`-style pass across all date displays in a future cleanup.

## 7. How to run

Same as Phase 1 (`npm run dev`, `npx tsx prisma/seed.ts` for demo data, `npx vitest run`, `npx playwright test`). No new environment variables required; `DOCUMENT_STORAGE_ROOT` optionally overrides where uploaded files land on disk (defaults to `<repo>/storage/patient-documents`, gitignored).

## 8. Recommended Phase 3 architecture

Phase 2 was deliberately built so Phase 3 (the actual dental chart, periodontal charting, and treatment plans) can slot in without touching this layer:

- **Chart tab is already reserved** in `PatientTabs` — wire a route at `/patients/[patientId]/chart` and it inherits the header, permissions, and "Back to Diary" context for free.
- **Reuse the versioning pattern**: a dental chart needs point-in-time snapshots exactly like `MedicalHistory` (CURRENT/PREVIOUS) — the same `status` + `completedAt`/`completedById` shape applies directly to chart entries or periodontal charts.
- **Reuse the lock pattern**: a signed treatment plan or completed chart entry should freeze the same way `ClinicalNote` does (`RecordLockedError`, amendment-only corrections) — don't invent a second locking mechanism.
- **Treatment plans should reference `ClinicalNote`/appointments**, not duplicate patient demographic data, following the same "link by ID, never copy" rule used for family relationships.
- **Tooth-level data** (the chart itself) will need its own table keyed by `patientId` + tooth number/surface — keep it a separate model from `MedicalHistory`, same separation-of-concerns reasoning already applied between clinical notes and admin notes.
- **Documents** already support a `CLINICAL_PHOTOGRAPH`/`RADIOGRAPH` category — Phase 3 can attach chart-linked X-rays through the existing upload/permission/byte-sniffing pipeline with no changes.
- **Permissions**: extend the existing `Permission` union (e.g. `patients.manageChart`, `patients.manageTreatmentPlans`) rather than overloading `manageClinicalNotes` — keep the same Receptionist/Practice-Manager/Clinician split already established.
