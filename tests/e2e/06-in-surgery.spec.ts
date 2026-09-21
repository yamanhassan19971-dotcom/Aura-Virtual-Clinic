import { test, expect } from "./fixtures";
import { appointmentCard, bookAppointment, login } from "./helpers";

test("Scenario 6: mark arrived as in surgery and a timestamp is recorded", async ({ page }) => {
  await login(page);

  await bookAppointment(page, {
    patientName: "Ahmed Hassan",
    practitioner: "Dr Ahmad",
    type: "Root Canal",
    time: "15:00",
  });
  await expect(page.getByText("Appointment booked")).toBeVisible();

  const card = appointmentCard(page, "Ahmed Hassan");
  await card.click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Arrived", exact: true }).click();
  await page.getByRole("button", { name: "In Surgery", exact: true }).click();

  await expect(card).toContainText("In Surgery");
  // Status history in the side panel should now include an IN_SURGERY row with a time.
  await expect(page.getByText(/— IN_SURGERY/)).toBeVisible();

  await page.getByRole("button", { name: "Close panel" }).click();
  const inSurgeryPanel = page.locator('[data-testid="in-surgery-panel"]');
  await expect(inSurgeryPanel.getByText("Ahmed Hassan")).toBeVisible();
});
