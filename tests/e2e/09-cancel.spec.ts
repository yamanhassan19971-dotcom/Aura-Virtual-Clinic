import { test, expect } from "./fixtures";
import { appointmentCard, bookAppointment, login } from "./helpers";

test("Scenario 9: cancelling an appointment keeps it visible, marked cancelled", async ({ page }) => {
  await login(page);

  await bookAppointment(page, {
    patientName: "Sara Ali",
    practitioner: "Dr Ahmad",
    type: "Examination",
    time: "09:45",
  });
  await expect(page.getByText("Appointment booked")).toBeVisible();

  const card = appointmentCard(page, "Sara Ali");
  await card.click();
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Cancel Appointment" })).toBeVisible();
  await page.getByLabel("Reason").selectOption({ label: "Patient cancelled" });
  await page.getByRole("button", { name: "Cancel Appointment", exact: true }).click();

  await expect(card).toContainText("Cancelled");
  await expect(card).toBeVisible();
});
