import { test, expect } from "./fixtures";
import { appointmentCard, bookAppointment, login, openPatientRecord } from "./helpers";

test("Scenario 18a: linking a family member shows reciprocally on both patient records", async ({ page }) => {
  await login(page);
  await openPatientRecord(page, "Ahmed Hassan");
  await page.getByRole("link", { name: "Details", exact: true }).click();

  await page.getByRole("button", { name: "Link Family Member" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Search by name, phone, patient ID or DOB").fill("Sara Ali");
  await dialog.locator('[data-testid="patient-search-results"]').getByText("Sara Ali", { exact: false }).first().click();
  await dialog.getByRole("combobox").selectOption({ label: "Spouse" });
  await dialog.getByRole("button", { name: "Save" }).click();

  // The name and "— Spouse" relation label render as adjacent sibling
  // spans with no literal space between them, so match loosely.
  await expect(page.getByText(/Sara Ali.*Spouse/)).toBeVisible();

  // Reciprocal: Sara Ali's own record should show Ahmed Hassan as her spouse too.
  await openPatientRecord(page, "Sara Ali");
  await page.getByRole("link", { name: "Details", exact: true }).click();
  await expect(page.getByText(/Ahmed Hassan.*Spouse/)).toBeVisible();
});

test("Scenario 18b: opening a patient from a diary card, and booking from the record, round-trips to the diary", async ({
  page,
}) => {
  await login(page);

  await bookAppointment(page, {
    patientName: "Ahmed Hassan",
    practitioner: "Dr Yaman Hassan",
    type: "Examination",
    time: "09:00",
  });
  await expect(page.getByText("Appointment booked")).toBeVisible();

  const card = appointmentCard(page, "Ahmed Hassan");
  await card.hover();
  await card.locator('[data-testid="appointment-open-patient"]').click();
  await page.waitForURL("**/patients/**/overview**");
  await expect(page.getByRole("heading", { name: "Ahmed Hassan" })).toBeVisible();

  // Book a second appointment directly from the patient record. Scoped to
  // "main" since the sidebar also has a global "Appointments" nav link.
  await page.getByRole("main").getByRole("link", { name: "Appointments", exact: true }).click();
  await page.getByRole("button", { name: "Book Appointment" }).first().click();
  const bookingDialog = page.getByRole("dialog");
  await bookingDialog.getByLabel("Practitioner").selectOption({ label: "Dr Ahmad" });
  await bookingDialog.getByLabel("Reason").selectOption({ label: "Hygiene" });
  await bookingDialog.getByLabel("Time", { exact: true }).fill("11:00");
  await bookingDialog.getByRole("button", { name: "Book Appointment" }).click();

  await expect(page.getByText("11:00")).toBeVisible();

  await page.goto("/en/appointments");
  await expect(appointmentCard(page, "Ahmed Hassan")).toHaveCount(2);
});
