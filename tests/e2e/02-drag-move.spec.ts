import { test, expect } from "./fixtures";
import { appointmentCard, bookAppointment, dragCardBy, login } from "./helpers";

test("Scenario 2: drag an appointment from 09:00 to 10:00 and the change persists", async ({ page }) => {
  await login(page);

  await bookAppointment(page, {
    patientName: "Ahmed Hassan",
    practitioner: "Dr Ahmad",
    type: "Examination",
    time: "09:00",
  });
  await expect(page.getByText("Appointment booked")).toBeVisible();

  const card = appointmentCard(page, "Ahmed Hassan");
  await expect(card).toContainText("09:00");

  // 15-min scale => ~2.27px/min; 60 minutes ≈ 136px.
  await dragCardBy(page, card, 136);

  await expect(card).toContainText("10:0", { timeout: 10000 });

  // Reload to prove the move was persisted server-side, not just optimistic client state.
  await page.reload();
  const cardAfterReload = appointmentCard(page, "Ahmed Hassan");
  await expect(cardAfterReload).toContainText("10:0");
});
