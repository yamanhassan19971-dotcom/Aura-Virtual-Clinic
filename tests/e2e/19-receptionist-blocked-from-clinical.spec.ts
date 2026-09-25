import { test, expect } from "./fixtures";
import { login, openPatientRecord } from "./helpers";

test("Scenario 19: a receptionist has full demographic access but is blocked from all clinical data", async ({
  page,
}) => {
  await login(page, "reception@aura.dev", "Passw0rd!");

  await openPatientRecord(page, "Ahmed Hassan");

  // Demographic/administrative access: fully available (quick actions in
  // the header are rendered as links, not buttons).
  await expect(page.getByRole("link", { name: "Edit Details" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Upload Document" })).toBeVisible();

  // Clinical tabs are shown but unreachable, not just hidden buttons within them.
  const medicalTab = page.getByText("Medical", { exact: true });
  const historyTab = page.getByText("Clinical History", { exact: true });
  await expect(medicalTab).toBeVisible();
  await expect(historyTab).toBeVisible();
  await expect(page.locator('a:has-text("Medical")')).toHaveCount(0);

  // No clinical quick actions in the header either.
  await expect(page.getByRole("button", { name: "New Medical History" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create Clinical Note" })).toHaveCount(0);

  // Direct URL navigation is blocked server-side too, not just the UI entry points.
  const medicalResponse = await page.goto(page.url().replace(/\/overview$/, "/medical"));
  expect(medicalResponse?.status()).toBe(404);
});
