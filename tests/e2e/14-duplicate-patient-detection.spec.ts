import { test, expect } from "./fixtures";
import { login } from "./helpers";

test("Scenario 14: creating a patient matching an existing name+DOB shows a duplicate warning with an override", async ({
  page,
}) => {
  await login(page);

  await page.goto("/en/patients");
  await page.getByRole("button", { name: "+ New Patient" }).click();

  // Ahmed Hassan / 1990-03-12 already exists in the e2e fixture.
  await page.getByLabel("First name").fill("Ahmed");
  await page.getByLabel("Last name").fill("Hassan");
  await page.getByLabel("Date of birth").fill("1990-03-12");
  await page.getByRole("button", { name: "Create Patient" }).click();

  const duplicateDialog = page.getByRole("dialog", { name: "Possible existing patient" });
  await expect(duplicateDialog).toBeVisible();
  await expect(duplicateDialog.getByText("Ahmed Hassan")).toBeVisible();

  await duplicateDialog.getByRole("button", { name: "Create New Patient Anyway" }).click();

  // The duplicate dialog closes and the new patient is created despite the match.
  await expect(page.getByRole("heading", { name: "Possible existing patient" })).not.toBeVisible();
});
