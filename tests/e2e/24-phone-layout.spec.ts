import { test, expect } from "./fixtures";
import { appointmentCard, bookAppointment } from "./helpers";
import type { Page } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function expectNoSidewaysScroll(page: Page) {
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(390);
}

test("Scenario 24: on a phone the menu folds away, an appointment opens as a sheet, and the patient's actions fold into More", async ({
  page,
}) => {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill("admin@aura.dev");
  await page.getByLabel("Password").fill("Passw0rd!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/appointments**");

  // The sidebar is a drawer: closed until the menu button opens it.
  await expect(page.getByRole("link", { name: "Patients" })).toBeHidden();
  await expectNoSidewaysScroll(page);

  await bookAppointment(page, {
    patientName: "Ahmed Hassan",
    practitioner: "Dr Ahmad",
    type: "Examination",
    time: "09:00",
  });
  await expect(page.getByText("Appointment booked")).toBeVisible();

  // No side panel at this width: tapping the appointment opens a bottom sheet.
  await appointmentCard(page, "Ahmed Hassan").tap();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Ahmed Hassan").first()).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).last().click();
  await expect(sheet).toBeHidden();

  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("link", { name: "Patients" }).click();
  await page.waitForURL("**/patients");
  await expect(page.getByRole("link", { name: "Patients" })).toBeHidden();

  await page.getByPlaceholder("Search by name, phone, patient ID or DOB").fill("Ahmed");
  await page.getByRole("link", { name: /Ahmed Hassan/ }).first().click();
  await page.waitForURL("**/patients/**/overview**");
  await expectNoSidewaysScroll(page);

  await expect(page.getByRole("link", { name: "Edit Details" })).toBeHidden();
  await page.getByText("More").click();
  await expect(page.getByRole("link", { name: "Edit Details" })).toBeVisible();
});
