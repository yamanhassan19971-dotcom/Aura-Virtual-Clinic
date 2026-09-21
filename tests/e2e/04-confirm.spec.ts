import { test, expect } from "./fixtures";
import { appointmentCard, bookAppointment, login } from "./helpers";

test("Scenario 4: mark a pending appointment as confirmed", async ({ page }) => {
  await login(page);

  await bookAppointment(page, {
    patientName: "Ahmed Hassan",
    practitioner: "Dr Yaman Hassan",
    type: "Hygiene",
    time: "13:00",
  });
  await expect(page.getByText("Appointment booked")).toBeVisible();

  const card = appointmentCard(page, "Ahmed Hassan");
  await expect(card).toContainText("Pending");
  await card.click();

  await page.getByRole("button", { name: "Confirm", exact: true }).click();

  await expect(card).toContainText("Confirmed");
});
