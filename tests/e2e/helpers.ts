import { expect, type Page } from "@playwright/test";

export async function login(page: Page, email = "admin@aura.dev", password = "Passw0rd!") {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/appointments**");
  await expect(page.getByRole("heading", { name: "Appointment Diary" })).toBeVisible();
}

export function appointmentCard(page: Page, patientName: string) {
  return page.locator(`[data-testid="appointment-card"][data-patient="${patientName}"]`);
}

export function diaryColumn(page: Page, practitionerName: string) {
  return page.locator(`[data-testid="diary-column"][data-practitioner-name="${practitionerName}"]`);
}

/** Books an appointment for `patientName` via the New Appointment modal. Assumes the patient already exists. */
export async function bookAppointment(
  page: Page,
  opts: { patientName: string; practitioner: string; type: string; time: string }
) {
  await page.getByRole("button", { name: "+ New Appointment" }).click();
  await page.getByPlaceholder("Search by name, phone, patient ID or DOB").fill(opts.patientName);
  await page
    .locator('[data-testid="patient-search-results"]')
    .getByText(opts.patientName, { exact: false })
    .first()
    .click();
  await page.getByLabel("Practitioner").selectOption({ label: opts.practitioner });
  await page.getByLabel("Reason").selectOption({ label: opts.type });
  await page.getByLabel("Time", { exact: true }).fill(opts.time);
  await page.getByRole("button", { name: "Book Appointment" }).click();
}

/** Drags an appointment card down/up by `deltaY` pixels using real pointer events, so dnd-kit's PointerSensor picks it up. */
export async function dragCardBy(page: Page, card: ReturnType<typeof appointmentCard>, deltaY: number) {
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  if (!box) throw new Error("Card not found for drag");
  const startX = box.x + box.width / 2;
  const startY = box.y + 8;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX, startY + (deltaY * i) / steps, { steps: 2 });
  }
  await page.mouse.up();
}

/** Opens a patient's record via the /patients search page and lands on its Overview tab. */
export async function openPatientRecord(page: Page, patientName: string) {
  await page.goto("/en/patients");
  await page.getByPlaceholder("Search by name, phone, patient ID or DOB").fill(patientName);
  await page.getByRole("link", { name: patientName, exact: false }).first().click();
  await page.waitForURL("**/patients/**/overview**");
}

/** Drags an appointment's resize handle down by `deltaY` pixels to grow its duration. */
export async function resizeCardBy(page: Page, card: ReturnType<typeof appointmentCard>, deltaY: number) {
  const handle = card.locator('[data-testid="appointment-resize-handle"]');
  await card.hover();
  const box = await handle.boundingBox();
  if (!box) throw new Error("Resize handle not found");
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX, startY + (deltaY * i) / steps, { steps: 2 });
  }
  await page.mouse.up();
}
