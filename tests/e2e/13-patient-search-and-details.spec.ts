import { test, expect } from "./fixtures";
import { login, openPatientRecord } from "./helpers";

test("Scenario 13: search for a patient, open the record, edit details, and confirm it persists after reload", async ({
  page,
}) => {
  await login(page);

  await openPatientRecord(page, "Sara Ali");
  await expect(page.getByRole("heading", { name: "Sara Ali" })).toBeVisible();

  await page.getByRole("link", { name: "Details", exact: true }).click();
  await page.getByRole("button", { name: "Edit Details" }).click();
  await page.getByLabel("City").fill("Aleppo");
  await page.getByLabel("Mobile phone").fill("+963 944 111 222");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByRole("button", { name: "Edit Details" })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("City")).toHaveValue("Aleppo");
  await expect(page.getByLabel("Mobile phone")).toHaveValue("+963 944 111 222");
});
