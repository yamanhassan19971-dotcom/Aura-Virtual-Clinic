import { test, expect } from "./fixtures";
import { bookAppointment, login } from "./helpers";

test("Scenario 10: booking an overlapping appointment shows a conflict warning", async ({ page }) => {
  await login(page);

  await bookAppointment(page, {
    patientName: "Ahmed Hassan",
    practitioner: "Dr Yaman Hassan",
    type: "Root Canal", // 90 minutes: 10:00-11:30
    time: "10:00",
  });
  await expect(page.getByText("Appointment booked")).toBeVisible();

  // Try to book a second, overlapping appointment for the same practitioner.
  await page.getByRole("button", { name: "+ New Appointment" }).click();
  await page.getByPlaceholder("Search by name, phone, patient ID or DOB").fill("Sara Ali");
  await page
    .locator('[data-testid="patient-search-results"]')
    .getByText("Sara Ali", { exact: false })
    .first()
    .click();
  await page.getByLabel("Practitioner").selectOption({ label: "Dr Yaman Hassan" });
  await page.getByLabel("Reason").selectOption({ label: "Examination" });
  await page.getByLabel("Time", { exact: true }).fill("10:30");
  await page.getByRole("button", { name: "Book Appointment" }).click();

  await expect(page.getByRole("heading", { name: "Appointment conflict" })).toBeVisible();
  await expect(page.getByText("This appointment overlaps with another appointment.")).toBeVisible();

  // Admin is allowed to override; confirm the override path completes the booking.
  await page.getByLabel("Reason for override").fill("Emergency squeeze-in");
  await page.getByRole("button", { name: "Book Anyway" }).click();

  await expect(page.getByText("Appointment booked")).toBeVisible();
});
