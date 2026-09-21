# AURA Dental PMS — PHASE 1

Dental Practice Appointment & Diary System

You are an expert senior full-stack software engineer and product designer specializing in dental practice-management software.

I want you to start building Phase 1 of a modern cloud-based Dental Practice Management System (PMS).

The product will eventually be a complete dental PMS inspired by the workflow of systems such as Dentally, but it must be an original implementation and design. Do not copy proprietary source code, assets, logos, branding, or copyrighted UI. We are using Dentally only as a reference for the underlying dental-practice workflow.

The product name for now is:

AURA Dental PMS

The system will eventually support:

* Patient management
* Dental charting
* Clinical notes
* Treatment planning
* Appointments
* Check-in / waiting room
* Treatment status
* Payments
* Recalls
* Communications
* Practice analytics
* Multi-clinic management
* AI-assisted dental workflows

However:

PHASE 1 MUST FOCUS PRIMARILY ON THE APPOINTMENT DIARY.

Do NOT attempt to build the entire PMS now.

The goal of Phase 1 is to create a highly functional prototype of the daily dental appointment book/diary that feels natural to a real dental practice.

---

## 1. MOST IMPORTANT REQUIREMENT

The appointment page is the heart of this phase.

I want a dental-practice diary where I can see:

* All clinicians
* Each clinician's patients
* The time of each appointment
* Appointment duration
* Appointment type/reason
* Patient name
* Appointment status
* Surgery/room
* Check-in status
* Waiting status
* In-surgery status
* Completed status
* Cancelled status
* FTA / Did Not Attend status

The page should allow reception staff and clinicians to manage the entire day's patient flow from one screen.

The experience should be optimized for a busy dental reception desk.

The diary must be much more than a generic calendar.

It needs to feel like a real dental appointment book.

---

## 2. DESIGN PHILOSOPHY

Use Dentally's appointment workflow as inspiration.

The Dentally workflow currently treats the calendar/diary/appointment book as the central place for viewing and booking appointments. Appointment cards contain patient, date/time, reason, status, duration, location, practitioner, room, lab work and notes.

The system should therefore prioritize:

**Speed** — Receptionists should be able to perform common actions in seconds.

**Visibility** — The whole practice's day should be visible at a glance.

**Density** — A large amount of useful information should fit on the screen without looking cluttered.

**Clarity** — Appointment status must be immediately obvious.

**Dental workflow** — The interface should feel designed for dentists, dental nurses, receptionists and practice managers — not like a generic Google Calendar clone.

---

## 3. TECHNOLOGY

Before coding:

1. Inspect the existing repository.
2. Determine the current framework and structure.
3. Reuse existing architecture where sensible.
4. Do not unnecessarily replace the entire project.
5. If the project is empty, choose a modern stable stack suitable for a SaaS web application.

Preferred architecture:

* React
* TypeScript
* Modern component-based architecture
* Responsive web application
* Proper state management
* Persistent database
* Clean API/service layer

If the existing project already uses another reasonable stack, do not rewrite it merely for preference.

The application should eventually be deployable as a cloud SaaS product.

---

## 4. LANGUAGE REQUIREMENT

The final product must support English and Arabic from the beginning.

Do NOT hard-code user-facing text throughout components.

Create a proper internationalization structure, e.g. `/i18n/en`, `/i18n/ar`.

The application must support English -> LTR and Arabic -> RTL.

The language switcher should be visible in the interface.

When Arabic is selected:

* Layout becomes RTL
* Text becomes Arabic
* Buttons reposition appropriately
* Tables/diary structure remains usable
* Icons remain logically positioned
* Sidebars adapt correctly

Do not simply translate English text at the end. Build the application so bilingual support is part of the architecture. For now, use professional dental terminology.

---

## 5. VISUAL DESIGN

The visual identity should be: Premium, Modern, Clinical, Minimal, Professional.

Avoid: cartoonish dental graphics, excessive gradients, excessive rounded cards, huge decorative elements, excessive animations, generic SaaS template appearance.

Think: modern private medical practice + premium SaaS dashboard.

Use a restrained palette. Suggested:

* Deep Navy: `#0F2747`
* Medical Blue: `#3B82F6`
* White: `#FFFFFF`
* Soft Grey: `#F5F7FA`
* Dark text: `#172033`

Use status colours only where necessary. The interface should feel appropriate for a premium dental practice.

---

## 6. MAIN APPLICATION STRUCTURE

Create a left navigation/sidebar. For Phase 1, the navigation can contain:

Dashboard, Appointments, Patients, Treatment Plans, Clinical, Reports, Settings

Only Appointments needs to be substantially functional in Phase 1. The other sections can be placeholders for future phases. Appointments should be visually emphasized as the main active module.

---

## 7. APPOINTMENTS PAGE

Create: Appointments / Diary — the most important screen.

At the top: `< Previous Day   TODAY   Next Day >` and a date selector, e.g. "Monday, 21 September 2026". Allow: Previous day, Next day, Today, Date picker.

---

## 8. PRACTITIONER FILTER

The user must be able to choose which clinicians are displayed, e.g.:

```
Practitioners:
[x] All
[x] Dr Yaman Hassan
[x] Dr Ahmad
[x] Dr Sara
[x] Dr Omar
[x] Hygienist Lina
```

Default: All clinicians. When all are selected, display them as separate columns. When one is selected, show only that clinician. Allow multiple selection.

---

## 9. PRACTICE / LOCATION FILTER

Build the architecture so multiple locations can eventually be supported. For now: `Location: [ Damascus Main Clinic v ]`. Eventually: Damascus, Aleppo, Daraa, etc. Do not build the complete multi-site system yet, but structure the data model so it can support it.

---

## 10. ROOM / SURGERY SUPPORT

Dental practices often have several surgeries: Surgery 1-4. An appointment should have a room. The diary should support both practitioner-based view and, eventually, room-based view. For Phase 1, practitioner-based view is the priority.

---

## 11. DAILY DIARY LAYOUT

I want a true vertical daily dental diary: time axis vertically, clinicians horizontally, appointments positioned according to their actual start time and duration.

---

## 12. TIME SCALE

The diary must support 5/10/15/30-minute intervals. Default: 15 minutes. Appointments can have arbitrary durations (10, 15, 20, 30, 45, 60, 90, 120 min). The height of the appointment should visually correspond to its duration (e.g. 30 min = 2 x 15-min slots, 60 min = 4 x 15-min slots).

---

## 13. APPOINTMENT CARD

Minimum information: Patient name, Appointment reason, Time, Duration, Status. Depending on space, also show Room and Clinician. Do not overcrowd appointment cards.

---

## 14. APPOINTMENT STATUS SYSTEM

Statuses: Pending, Confirmed, Arrived, In Surgery, Completed, Cancelled, FTA.

* **Pending** — Appointment booked but attendance not confirmed.
* **Confirmed** — Patient has confirmed.
* **Arrived** — Patient has arrived at the practice.
* **In Surgery** — Patient has been seated / treatment has started.
* **Completed** — Appointment completed.
* **Cancelled** — Patient cancelled.
* **FTA** — Patient did not attend.

---

## 15. STATUS TRANSITION

Typical flow: Pending -> Confirmed -> Arrived -> In Surgery -> Completed. But allow staff with appropriate permissions to change status manually (e.g. Pending -> Cancelled, Confirmed -> FTA, Arrived -> Cancelled). Do not make the workflow unnecessarily restrictive in Phase 1.

---

## 16. CHECK-IN

Fast check-in: click appointment, then `[ MARK AS ARRIVED ]`. Status changes to ARRIVED and the card visually updates. Create a conceptual Waiting Room panel showing patient, clinician, appointment time, arrived time.

---

## 17. IN-SURGERY

Clinician clicks "In Surgery"; status changes Arrived -> In Surgery. Record time arrived and time seated, to support later analytics (waiting time, chair time, appointment duration).

---

## 18. COMPLETE APPOINTMENT

Click "Complete"; record Completed at timestamp. Later this connects to clinical notes, treatment performed, charges, payment, next appointment. For Phase 1, just record completion status and timestamp.

---

## 19. FTA

FTA = Failed To Attend / Did Not Attend. Confirmation dialog with patient, appointment, reason dropdown (Did not attend, No response, Forgot appointment, Other), and notes. Store the reason. Do not delete the appointment — it remains visible in historical records.

---

## 20. CANCEL APPOINTMENT

Dialog with reason (Patient cancelled, Clinic cancelled, Rescheduled, Other) and notes. The appointment should remain in the diary as cancelled rather than disappearing.

---

## 21. COLOUR / VISUAL STATUS

Do not rely exclusively on colour. Every status should have text, optional icon, subtle colour treatment. Suggested: Pending neutral, Confirmed blue, Arrived amber, In Surgery strong blue, Completed green, Cancelled grey, FTA red. Accessibility is important.

---

## 22. BOOK NEW APPOINTMENT

Clicking an empty diary slot opens "New Appointment" with fields: Patient (search), Date, Time, Duration, Practitioner, Room, Reason, Status, Notes. Buttons: Cancel, Book Appointment. Practitioner defaults to the column clicked; time defaults to the slot clicked.

---

## 23. PATIENT SEARCH

Search by first name, last name, full name, patient ID, phone number, date of birth. Show results immediately, each showing DOB, phone, patient ID. Allow "+ New Patient" to create a basic patient record in Phase 1.

---

## 24. DRAG AND DROP

Receptionist can drag an appointment to a new time/practitioner/room. The appointment updates date, time, practitioner, room. Show confirmation before major changes; do not allow accidental silent data loss.

---

## 25. RESIZE APPOINTMENTS

Allow changing duration by dragging the bottom edge of an appointment (e.g. 30 min -> 60 min). The appointment duration/end time updates.

---

## 26. APPOINTMENT DETAILS PANEL

Clicking an existing appointment opens a side panel (not full-page navigation) showing patient, reason, time, practitioner, room, status, patient info (DOB, phone), notes, quick action buttons (Arrived, In Surgery, Complete), and "More actions" (Edit, Reschedule, Cancel, Mark FTA, Open Patient).

---

## 27. QUICK ACTIONS

On hover/click of an appointment: Confirm, Arrived, In Surgery, Complete, Edit, Reschedule, Cancel, FTA. Don't make reception open several screens for basic actions.

---

## 28. TODAY'S PATIENT FLOW

Compact summary strip at top: Appointments, Confirmed, Pending, Arrived, In Surgery, Completed, FTA, Cancelled counts. These update dynamically. Clicking a status filters the diary (e.g. click "Arrived: 3" -> show only arrived appointments).

---

## 29. WAITING ROOM PANEL

Collapsible right-side panel: "Waiting Room", count of patients waiting, each with name, clinician, arrived time, waiting duration. Clicking a patient opens their appointment.

---

## 30. CURRENTLY IN SURGERY

Show "In Surgery" list: clinician, patient, started time. Lets reception know which clinicians are currently treating patients.

---

## 31. CURRENT TIME INDICATOR

Horizontal "NOW" line at the current time, moving automatically. The diary should auto-scroll to the current time on open. Provide a "Jump to Now" button.

---

## 32. WORKING HOURS

Practice working hours per weekday, e.g. Mon-Wed 08:00-18:00. Clinicians can eventually have individual schedules; for now, sample schedules. Outside working hours, the diary should visually distinguish unavailable time.

---

## 33. CLINICIAN AVAILABILITY

Sample data for Dr Yaman Hassan, Dr Ahmad, Dr Sara, Dr Omar. Each clinician has: name, role, working hours, active/inactive, default room. Managed via basic Settings in Phase 1.

---

## 34. RESPONSIVE BEHAVIOUR

Desktop is the primary interface (reception, practice manager, dentist computers). The diary must work especially well at 1440x900 and 1920x1080. Do not prioritize mobile over desktop for Phase 1, but the interface should not completely break on tablets.

---

## 35. DEMO DATA

4 clinicians, 4 surgeries, 30-50 patients, at least 40 appointments for one day. Appointment types: Examination, Emergency, Composite, RCT, Crown, Extraction, Hygiene, Consultation, Follow-up, Whitening. Include all statuses. The diary should look like a real busy dental practice.

---

## 36. APPOINTMENT TYPES

Configurable appointment reasons: Examination, Emergency, Hygiene, Composite, Crown, Bridge, Root Canal, Extraction, Consultation, Follow-up, Whitening, Other. Each has name, default duration, active/inactive. Example durations: Examination 30, Emergency 30, RCT 90, Hygiene 45. Default duration auto-populates when selecting reason, but remains editable.

---

## 37. DATABASE DESIGN

At minimum: `users`, `practitioners`, `patients`, `practices`, `rooms`, `appointment_types`, `appointments`, `appointment_status_history`.

Appointments should contain approximately:

```
id
patient_id
practitioner_id
practice_id
room_id
appointment_type_id
date
start_time
end_time
duration
status
notes
created_at
updated_at
arrived_at
in_surgery_at
completed_at
cancelled_at
fta_at
cancellation_reason
fta_reason
```

Use appropriate relational relationships. Do not store everything as one JSON object.

---

## 38. STATUS HISTORY

Every status change should be recorded. Create `appointment_status_history` with: `appointment_id`, `previous_status`, `new_status`, `changed_by`, `changed_at`, `reason`. Essential later for reporting and audit trails.

---

## 39. AUDIT LOG

Log important actions: appointment created, edited, moved, resized, status changed, cancelled, marked FTA. Store: user, action, timestamp, record, previous value, new value. This is a healthcare application, so data traceability must be considered from the beginning.

---

## 40. PERMISSIONS

Basic roles:

* **Admin** — Full access.
* **Practice Manager** — Appointments + reports + practice settings.
* **Receptionist** — Appointments + patient basic information.
* **Clinician** — Appointments + own patient information.

For Phase 1, permissions can be basic, but the architecture must support granular permissions later.

---

## 41. IMPORTANT UX PRINCIPLE

The appointment diary must NOT behave like a generic project-management calendar. It should feel like a Dental Practice Diary. The receptionist should be able to sit in front of it at 8:00 AM and run the entire practice from this screen, answering: who is coming, when, which dentist, which surgery, confirmed?, arrived?, waiting?, in surgery?, finished?, cancelled?, FTA?, where are the gaps?

---

## 42. GAP VISIBILITY

Empty diary spaces should be visually obvious (e.g. an "EMPTY" band between booked slots), so a practice manager can immediately see unused capacity. Later this can become an automated scheduling/recall feature.

---

## 43. OVERBOOKING / CONFLICT DETECTION

If a booking would overlap an existing appointment for that practitioner, show a conflict dialog naming the existing appointment and asking to continue. Do not silently create conflicting appointments.

---

## 44. DOUBLE BOOKING

For Phase 1, allow an administrator/practice manager to override a conflict if required, but clearly warn ("This appointment overlaps with another appointment") and store the override.

---

## 45. NAVIGATION BETWEEN DAYS

Previous day, Next day, Today, Select date. Keyboard shortcuts: <- previous day, -> next day, T = today.

---

## 46. WEEK VIEW

Do NOT spend significant development time building a complicated week view yet. Phase 1 priority: the daily view must be excellent. A simple week view can be added later.

---

## 47. DO NOT BUILD YET

Full clinical chart, periodontal chart, treatment plans, invoices, payment processing, NHS claims, AI, X-ray analysis, patient portal, online booking, WhatsApp API, email automation, advanced reporting, inventory, lab management. These belong to later phases. Placeholder navigation only.

---

## 48. IMPORTANT FUTURE ARCHITECTURE

Structure the system so appointments can eventually connect to:

```
Patient -> Appointment -> Clinical Note -> Dental Chart -> Treatment -> Treatment Plan -> Invoice -> Payment -> Recall
```

Do not build a temporary architecture that will need to be thrown away later.

---

## 49. SECURITY

Treat the application as if it will eventually contain real patient information. Implement good foundations: authentication, password hashing, role-based permissions, protected API routes, input validation, database constraints, audit logging, no patient information in URLs unnecessarily, no sensitive information in browser console logs, proper session handling. Use synthetic demo patients only.

---

## 50. ERROR HANDLING

Handle: invalid appointment, missing patient, missing practitioner, invalid duration, time conflict, network/database error, unauthorized action. Errors should be understandable to a receptionist (e.g. "We couldn't save this appointment. Please try again." rather than "Error 500").

---

## 51. PERFORMANCE

Fast initial loading, smooth scrolling, smooth drag-and-drop, no unnecessary page reloads, immediate UI feedback, optimistic updates where safe. Do not reload the entire page after every appointment action.

---

## 52. TESTING

Before considering Phase 1 complete, test the following workflow:

1. Create patient. Book appointment. Appointment appears in correct clinician column and correct time.
2. Drag appointment from 09:00 to 10:00. Verify database updates.
3. Resize 30 minutes to 60 minutes. Verify end time updates.
4. Mark Pending -> Confirmed.
5. Mark Confirmed -> Arrived. Verify waiting room updates.
6. Mark Arrived -> In Surgery. Verify timestamp.
7. Mark In Surgery -> Completed. Verify timestamp.
8. Mark appointment FTA. Verify appointment remains visible in historical diary.
9. Cancel appointment. Verify it remains visible but clearly marked cancelled.
10. Attempt overlapping appointments. Verify warning.
11. Switch English -> Arabic. Verify complete RTL transformation.
12. Switch Arabic -> English. Verify LTR transformation.

---

## 53. DEVELOPMENT PROCESS

Do NOT immediately generate hundreds of files. First inspect the existing project, explain the existing architecture briefly, create a proposed Phase 1 architecture, identify dependencies to install, then implement in order: data model, application shell, appointment diary, appointment creation/editing, status workflow, drag-and-drop/resizing, waiting room, Arabic/English RTL/LTR, realistic demo data, test the complete workflow, fix bugs and polish.

---

## 54. DO NOT ASK ME TO APPROVE EVERY SMALL STEP

Use reasonable engineering judgment. If something is unclear but does not materially affect the architecture, choose the sensible option and continue. Stop only for major architectural decisions.

---

## 55. DO NOT OVERENGINEER

This is Phase 1, not the entire Dentally platform. Prefer one extremely polished appointment system over twenty mediocre features.

---

## 56. DEFINITION OF DONE

Phase 1 is complete when the application shows something resembling a real dental practice's daily diary, and the user can: create appointments, move appointments, resize appointments, edit appointments, cancel appointments, mark FTA, confirm patients, check patients in, move patients into surgery, complete appointments, see waiting patients, see current patients in surgery, see all clinicians, see all surgeries, filter clinicians, navigate dates, see appointment gaps, search patients, create a new patient, switch between Arabic and English, switch between RTL and LTR — and the interface should feel like a real professional dental practice management application, not a generic calendar prototype.

---

## 57. FINAL INSTRUCTION

Start with Phase 1 only. Do not build the later modules yet. Prioritize the appointment diary above everything else.

After implementation, provide: what was built, files/components created, database schema, how to run the application, test results, known limitations, and what should be built in Phase 2.

The architecture must remain extensible so that Phase 2 can add patient records, clinical notes, dental charting and treatment planning without rebuilding the appointment system.

END OF PHASE 1 PROMPT
