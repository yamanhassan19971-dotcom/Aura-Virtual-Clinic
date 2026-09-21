import { test, expect } from "./fixtures";
import { appointmentCard, bookAppointment, login } from "./helpers";

test("Scenario 8: marking an appointment FTA keeps it visible in the diary", async ({ page }) => {
  await login(page);

  await bookAppointment(page, {
    patientName: "Ahmed Hassan",
    practitioner: "Dr Yaman Hassan",
    type: "Examination",
    time: "09:30",
  });
  await expect(page.getByText("Appointment booked")).toBeVisible();

  const card = appointmentCard(page, "Ahmed Hassan");
  await card.click();
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("button", { name: "Mark FTA" }).click();

  await expect(page.getByRole("heading", { name: "Mark as FTA" })).toBeVisible();
  await page.getByLabel("Reason").selectOption({ label: "Did not attend" });
  await page.getByRole("button", { name: "Mark FTA", exact: true }).click();

  await expect(card).toContainText("FTA");
  await expect(card).toBeVisible();
});
