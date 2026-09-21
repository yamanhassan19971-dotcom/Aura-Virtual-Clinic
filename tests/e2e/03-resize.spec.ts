import { test, expect } from "./fixtures";
import { appointmentCard, bookAppointment, login, resizeCardBy } from "./helpers";

test("Scenario 3: resize an appointment from 30 to 60 minutes and the end time updates", async ({ page }) => {
  await login(page);

  await bookAppointment(page, {
    patientName: "Sara Ali",
    practitioner: "Dr Yaman Hassan",
    type: "Examination", // defaults to 30 minutes
    time: "11:00",
  });
  await expect(page.getByText("Appointment booked")).toBeVisible();

  const card = appointmentCard(page, "Sara Ali");
  await expect(card).toContainText("11:00");
  await expect(card).toContainText("11:30");

  // 15-min scale => ~2.27px/min; growing by 30 minutes ≈ 68px.
  await resizeCardBy(page, card, 68);

  await expect(card).toContainText("12:00", { timeout: 10000 });

  await page.reload();
  const cardAfterReload = appointmentCard(page, "Sara Ali");
  await expect(cardAfterReload).toContainText("12:00");
});
