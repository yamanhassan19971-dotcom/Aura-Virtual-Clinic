import { test, expect } from "./fixtures";
import { login } from "./helpers";

test("Scenario 23: an enquiry is logged, booked for a free consultation, confirmed from the follow-up list, and counted", async ({
  page,
  browser,
}) => {
  // A fresh number each run, so earlier runs' patients don't show as phone matches.
  const phone = `09${String(Date.now()).slice(-8)}`;

  await login(page, "reception@aura.dev");
  await page.getByRole("link", { name: "Enquiries" }).click();
  await page.getByRole("button", { name: "+ New enquiry" }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Name", { exact: true }).fill("Samer Halabi");
  await form.getByLabel("Phone", { exact: true }).fill(phone);
  await form.getByLabel("Their important words").fill("Broken molar, wants it fixed fast");
  await form.getByRole("button", { name: "Save" }).click();

  await page.waitForURL("**/leads/**");
  await expect(page.getByRole("heading", { name: "Handoff card" })).toBeVisible();
  await expect(page.getByText("Broken molar, wants it fixed fast")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open in WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/9639/);

  await page.getByRole("button", { name: "Book free consultation" }).click();
  const booking = page.getByRole("dialog");
  await expect(booking.getByLabel("First name")).toHaveValue("Samer");
  await expect(booking.getByLabel("Last name")).toHaveValue("Halabi");
  await booking.getByLabel("or age").fill("40");
  await booking.getByRole("button", { name: "Book and send confirmation" }).click();
  await expect(booking).toBeHidden();
  await expect(page.getByText("Consultation booked", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Patient file: Samer Halabi/ })).toBeVisible();

  // The booking put a confirmation message on today's follow-up list.
  await page.getByRole("link", { name: /^Follow-up/ }).click();
  const confirmation = page.locator('[data-testid="follow-up"][data-kind="CONFIRM_BOOKING"]', { hasText: "Samer Halabi" });
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByText("هالموعد محجوز إلك")).toBeVisible();
  await confirmation.getByRole("button", { name: "Done" }).click();
  await expect(confirmation).toBeHidden();

  // The manager sees it in the weekly numbers.
  const manager = await (await browser.newContext()).newPage();
  await login(manager, "manager@aura.dev");
  await manager.goto("/en/reports");
  await expect(manager.getByText("1 new enquiry")).toBeVisible();
  await expect(manager.getByTestId("kpi")).toHaveCount(6);
});
