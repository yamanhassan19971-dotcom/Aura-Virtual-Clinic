import { test, expect } from "./fixtures";
import { appointmentCard, login } from "./helpers";

test("Scenario 1: create a new patient, book an appointment, it appears in the right column and time", async ({
  page,
}) => {
  await login(page);

  await page.getByRole("button", { name: "+ New Appointment" }).click();
  await page.getByPlaceholder("Search by name, phone, patient ID or DOB").fill("Layla Nassar");
  await page.getByRole("button", { name: "+ New Patient" }).click();

  await page.getByLabel("First name").fill("Layla");
  await page.getByLabel("Last name").fill("Nassar");
  await page.getByLabel("Date of birth").fill("1995-06-15");
  await page.getByRole("button", { name: "Create Patient" }).click();

  await page.getByLabel("Practitioner").selectOption({ label: "Dr Yaman Hassan" });
  await page.getByLabel("Reason").selectOption({ label: "Examination" });
  await page.getByLabel("Time", { exact: true }).fill("08:15");
  await page.getByRole("button", { name: "Book Appointment" }).click();

  await expect(page.getByText("Appointment booked")).toBeVisible();

  const card = appointmentCard(page, "Layla Nassar");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Examination");
  await expect(card).toContainText("08:15");

  // Confirm it landed under the correct practitioner's column, not just anywhere on the page.
  const column = page.locator('[data-testid="diary-column"][data-practitioner-name="Dr Yaman Hassan"]');
  await expect(column.locator('[data-testid="appointment-card"][data-patient="Layla Nassar"]')).toBeVisible();
});
