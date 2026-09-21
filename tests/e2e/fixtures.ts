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
    await use(page);
  },
});

export { expect };
