import { test, expect } from "./fixtures";
import { appointmentCard, bookAppointment, login } from "./helpers";

test("Scenario 5: mark confirmed as arrived and the waiting room updates", async ({ page }) => {
  await login(page);

  await bookAppointment(page, {
    patientName: "Sara Ali",
    practitioner: "Dr Ahmad",
    type: "Examination",
    time: "14:00",
  });
  await expect(page.getByText("Appointment booked")).toBeVisible();

  const card = appointmentCard(page, "Sara Ali");
  await card.click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await page.getByRole("button", { name: "Arrived", exact: true }).click();
  await expect(card).toContainText("Arrived");

  await page.getByRole("button", { name: "Close panel" }).click();

  const waitingRoom = page.locator('[data-testid="waiting-room-panel"]');
  await expect(waitingRoom.getByText("Sara Ali")).toBeVisible();
});
