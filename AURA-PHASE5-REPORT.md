# AURA Dental PMS — Phase 5 Report

Scope: the call-centre pipeline and patient follow-up from the Phase 3 patient-journey script (first WhatsApp message → call → free consultation → treatment → review), plus the weekly six-KPI report, added to Phases 1-4 without rebuilding them. Every mutation is permission-checked and audited in the same transaction; every new string is in English and Arabic. Messages to patients are always Arabic.

## 1. What was built

- **Leads** (sidebar). A board with the script's four open stages: New message, Call booked, Thinking, Consultation booked; closed leads (Attended / Lost, last 30 days) behind a toggle. A card turns red when the first reply is over the 5-minute target.
- **New enquiry** captures the script's handoff card: name, phone, source and campaign, treatment of interest, who it's for, where they live, their key words, and what we told them. Lead numbers run `L-000001`.
- **Lead page**: the handoff card, a timeline, and actions: mark replied, book a call slot, log a call (no answer / reached / WhatsApp sent / note), Thinking with a follow-up date, Lost with a reason, Reopen. "No answer" schedules the next attempt automatically (an hour later; from the third attempt the next day at 11:00 or 17:00).
- **Ready messages**: first reply, offer a call, no reply after 2h, missed call, out of hours. Each opens WhatsApp on the patient's number with the text filled in (`wa.me`), or copies it. Nothing is ever sent automatically.
- **Book free consultation** in one transaction: creates the patient (or links an existing one with the same phone), books a confirmed appointment with the lead's key words as the note, and links lead ↔ patient ↔ appointment. Age is accepted when the date of birth is unknown. A clash shows inline.
- **Follow-ups** (sidebar, with a due-today badge): Today / Next two weeks / Done (7 days). Each item shows the patient, the appointment or plan it belongs to, a ready Arabic message with WhatsApp / call / copy, and Done (with outcome note), Tomorrow, Skip. Manual follow-ups can be added from the patient's overview, which also lists the patient's follow-ups.
- **Weekly KPIs** (Reports, was a placeholder): reply speed (median minutes, % within 5), message → call, call → consultation, attendance vs no-shows, plan acceptance, review requests and average satisfaction; a 4-week trend; lead sources and lost reasons. Weeks run Saturday-Thursday.

## 2. Follow-ups generated automatically

| Trigger | Follow-up | When |
|---|---|---|
| Appointment booked | Booking confirmation (with address) | now |
| | Reminder | day before 18:00 (Thursday for a Saturday visit) |
| | Reminder | 3 hours before (or opening time) |
| Rescheduled / cancelled | open reminders moved / skipped | |
| Patient arrives | open reminders skipped; a consultation lead becomes Attended | |
| Surgical visit completed (type flagged post-op) | same evening, next day call, 4 days later | 19:00 / 11:00 / 12:00 |
| No-show | rebook call; a consultation lead goes back to Thinking instead | now |
| Plan presented | decision call (skipped once accepted / declined / cancelled) | 3 days, 12:00 |
| Plan completed | satisfaction call, recall | next day 12:00, 6 months |
| Satisfaction 9-10 | Google review request | now |

Friday is skipped (moved to Saturday, or back to Thursday for the day-before reminder). Reminders already in the past are not created. Post-op types: Implant Surgery, 4D Smile Surgery, Prosthesis Delivery, Veneers Preparation, Root Canal, Extraction (`postOpFollowUp` on the appointment type).

## 3. Permissions

| | Admin | Manager | Reception | Clinician |
|---|---|---|---|---|
| View / manage leads | ✓ | ✓ | ✓ | |
| View follow-ups | ✓ | ✓ | ✓ | ✓ |
| Complete / skip / add follow-ups | ✓ | ✓ | ✓ | |
| Weekly KPIs | ✓ | ✓ | | |

## 4. Database

One additive migration, `phase5_patient_pipeline_follow_ups`: `Lead`, `LeadActivity`, `FollowUp` and their enums, `AppointmentType.postOpFollowUp`, `Practitioner.nameAr` (the doctor's name in patient messages). Follow-ups are written by `src/lib/services/follow-up-hooks.ts` inside the appointment and billing transactions, so they can never disagree with the diary. Scheduling rules are pure functions in `src/lib/followups/schedule.ts`; message templates in `templates.ts`.

## 5. Fixes found on the way

- New patient codes: demo codes like `P30008` sorted above `A…` codes, so every new patient got the same next code and failed. `nextPatientCode` now only looks at `A` codes (regression test added).
- Patient overview: the Documents card's empty state said "Nothing outstanding"; the Arabic date of birth rendered scrambled.

## 6. Tests

- Unit: 20 new tests (`tests/unit/pipeline.test.ts`) plus the patient-code regression; 94 total, all passing.
- E2E: new Scenario 23 (an enquiry is logged, replied to, a missed call reschedules, the consultation is booked, the confirmation appears in follow-ups). Full suite 29/29.

## 7. Open items for the clinic

- Google review link and maps link (`CLINIC_PROFILE.googleReviewUrl`, `mapsUrl`): messages show a placeholder until set.
- Doctors' full Arabic names for patient messages (first names used for now).
- Post-operative instructions per procedure, if they should go with the same-evening message.
- Real staff accounts with real names: messages say "معك {staff name}".

## 8. Next phases

- Phone and iPad layout (collapsible sidebar).
- Complaints with the one-week reply.
- Staff/user management and password change screens.
- Local deployment on the clinic laptop with daily backups, and private remote access for the owner's devices.
