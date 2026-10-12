import { test as base, expect } from "@playwright/test";
import { prisma } from "./db";

// Every spec books/moves/cancels its own appointments through the UI, so
// each test needs a clean appointments table — otherwise a patient name
// reused across spec files (e.g. "Ahmed Hassan") resolves to multiple
// cards and every locator by data-patient becomes ambiguous.
export const test = base.extend({
  page: async ({ page }, use) => {
    await prisma.auditLog.deleteMany();
    await prisma.appointmentStatusHistory.deleteMany();
    await prisma.appointment.deleteMany();
    // Same reasoning for the dental chart — patients are reused across spec
    // files, so each test needs a clean chart/BPE/image slate too.
    await prisma.clinicalImage.deleteMany();
    await prisma.bpeSextantScore.deleteMany();
    await prisma.bpeExam.deleteMany();
    await prisma.chartEntry.deleteMany();
    // Phase 4: plans and payments, for the same reason.
    await prisma.refundRequest.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.treatmentPlanItem.deleteMany();
    await prisma.treatmentPlan.deleteMany();
    await use(page);
  },
});

export { expect };
