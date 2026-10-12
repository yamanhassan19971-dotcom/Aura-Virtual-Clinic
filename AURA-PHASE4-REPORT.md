# AURA Dental PMS — Phase 4 Report

Scope: treatment plans, payments and refunds built around AURA's own rules, plus AURA's real clinic data, added to Phases 1-3 without rebuilding them. Every mutation is permission-checked and audited in the same transaction; every new string is in English and Arabic.

## 1. What was built

- **Patient → Treatment Plans** (was a placeholder). A doctor creates a plan, adds treatments from the clinic price list (or a custom line), with teeth, quantity and price. Plan lifecycle: Draft → Presented → Accepted → In progress → Completed, with Declined / Cancelled side exits (with an optional reason kept for the follow-up team) and Reopen. Marking the first treatment done moves the plan to In progress; when nothing is left planned it completes itself.
- **Staged payments.** Each plan splits its total 50/30/20 (editable per plan before acceptance) and shows which stage is settled and what is due next.
- **Patient → Account** (was a placeholder). Summary tiles (accepted treatment, paid, balance due, pending refunds), payments with sequential receipt numbers, and refund requests.
- **Payments** in USD or SYP (SYP stores the exchange rate and its USD equivalent), by cash, Sham Cash, bank transfer or other. Mistakes are voided with a reason, never deleted.
- **Refund requests**, electronic or in person, with a due date 3 working days out (Friday skipped) and an Overdue badge; a manager marks them refunded (with method) or rejected.
- **Treatment Plans page** (sidebar, was a placeholder): every plan in the clinic filtered by status, defaulting to *Presented*, i.e. patients who have seen a plan and not yet decided: the follow-up call list.
- **Settings → Treatments & Prices**: the price list, editable inline. Prices are copied into a plan when added, so changing a price never changes existing plans.
- **Print views**: the written treatment plan the doctor hands the patient (logo, clinic address and phone, treatments, total, the three payment stages, signature lines) and an A5 payment receipt.

## 2. AURA business rules enforced on the server

| Rule | Where |
|---|---|
| Deposit only after the patient accepts the plan | `recordPayment` → `PLAN_NOT_ACCEPTED` |
| Deposit never more than 5% of the plan total (cumulative) | `recordPayment` → `DEPOSIT_OVER_LIMIT` |
| Prices, items, discount and split are frozen once accepted | `assertEditable` → `PLAN_LOCKED` |
| No payment beyond the remaining balance ($1 tolerance for SYP rounding) | `OVERPAYMENT` |
| Refunds can't exceed what was paid, counting open requests | `REFUND_OVER_PAID` |
| Stage split must total 100% | zod refine |

Rule errors carry a stable `code` translated under `billing.errors.*`.

## 3. Permissions

| | Admin | Manager | Reception | Clinician |
|---|---|---|---|---|
| View plans and account | ✓ | ✓ | ✓ | ✓ |
| Build / edit / present plans, mark treatment done | ✓ | ✓ | | ✓ |
| Record the patient's accept / decline | ✓ | ✓ | ✓ | ✓ |
| Take payments, log refund requests | ✓ | ✓ | ✓ | |
| Void payments, pay out / reject refunds | ✓ | ✓ | | |
| Edit price list | ✓ | ✓ | | |

## 4. Database

One additive migration, `phase4_treatment_plans_payments`: `TreatmentCatalogItem`, `TreatmentPlan`, `TreatmentPlanItem`, `Payment`, `RefundRequest`. Money is stored as integers (USD cents, whole SYP) to avoid floating-point drift and Decimal serialization through server actions. Arithmetic lives in one pure module, `src/lib/billing/money.ts`.

## 5. AURA clinic data

`prisma/aura-clinic-data.ts` holds AURA's doctors (Dr Yaman Hassan, Dr Wajih Jahjah, Dr Amr Odeh, Dr Adham Farroukh, Dr Abeer Al-Rifai), hours (10:00-20:00, Friday closed), appointment types and price list (implants, 4D Smile packages, orthodontics, Hollywood Smile). It feeds both the demo seed and the new `npm run db:setup-clinic` go-live script, which creates staff logins with one-time passwords and no demo patients. The diary now runs to 21:00 so evening appointments are visible, and the sidebar shows the Jdeidet Artouz branch.

## 6. Tests

- Unit: 21 new tests (`tests/unit/billing-service.test.ts`), 73 total, all passing.
- E2E: new Scenario 22 (doctor builds and presents a plan, reception records acceptance, a 5%-capped deposit is refused then accepted, a payment settles stage 1). Full suite: 27/28 passed; Scenario 16 (clinical note sign) failed once and passed on rerun, the timing flake already noted in the Phase 2 report, untouched by this phase.

## 7. Open items for the clinic

- Room names are placeholders (Surgery 1-3); confirm the real surgeries.
- Prices with no figure yet (Straumann, bone graft) are $0 in the list, priced by the doctor per plan.
- Exchange rate is typed per SYP payment; there is no stored daily rate yet.

## 8. Next phases

- Phone and iPad layout (the app shell is desktop-first; the sidebar doesn't collapse yet).
- Call-centre pipeline: leads from WhatsApp → call slot → booking, with the handoff card from the Phase 3 patient-journey script.
- Follow-up and recall (same evening, next day, 3-7 days, end of treatment), complaints with the one-week reply, weekly KPIs.
- Staff/user management and password change screens.
- Clinic-car bookings around appointments.
- Local deployment on the clinic laptop with daily backups, and private remote access for the owner's devices.
