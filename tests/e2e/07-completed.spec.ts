import { test, expect } from "./fixtures";
import { appointmentCard, bookAppointment, login } from "./helpers";

test("Scenario 7: mark in-surgery as completed and a timestamp is recorded", async ({ page }) => {
  await login(page);

  await bookAppointment(page, {
    patientName: "Sara Ali",
    practitioner: "Dr Yaman Hassan",
    type: "Hygiene",
    time: "16:00",
  });
  await expect(page.getByText("Appointment booked")).toBeVisible();

  const card = appointmentCard(page, "Sara Ali");
  await card.click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Arrived", exact: true }).click();
  await page.getByRole("button", { name: "In Surgery", exact: true }).click();
  await page.getByRole("button", { name: "Complete", exact: true }).click();

  await expect(card).toContainText("Completed");
  await expect(page.getByText(/— COMPLETED/)).toBeVisible();

  // Completed appointments drop out of the waiting room / in-surgery panels.
  await page.getByRole("button", { name: "Close panel" }).click();
  const inSurgeryPanel = page.locator('[data-testid="in-surgery-panel"]');
  await expect(inSurgeryPanel.getByText("Sara Ali")).toHaveCount(0);
});
