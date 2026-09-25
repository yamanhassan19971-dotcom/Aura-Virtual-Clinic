import { test, expect } from "./fixtures";
import { login, openPatientRecord } from "./helpers";

async function answerYesNo(page: import("@playwright/test").Page, questionLabel: string, freeText?: string) {
  // Scoped to the open modal dialog so a pre-existing alert badge elsewhere
  // on the page (which also renders this question's label text) is never
  // matched instead of the actual form question.
  const dialog = page.getByRole("dialog");
  const row = dialog.locator("span", { hasText: questionLabel }).first().locator("xpath=..");
  await row.getByRole("button", { name: "Yes", exact: true }).click();
  if (freeText) {
    await row.getByPlaceholder("Add detail (optional)").fill(freeText);
  }
}

test("Scenario 15: submitting medical history twice versions it and raises an alert", async ({ page }) => {
  await login(page);
  await openPatientRecord(page, "Sara Ali");
  await page.getByRole("link", { name: "Medical", exact: true }).click();

  await page.getByRole("button", { name: "New Medical History" }).first().click();
  await answerYesNo(page, "Drug allergy", "Penicillin");
  await page.getByRole("button", { name: "Save Medical History" }).click();

  // Alert badge appears in the header immediately after submission.
  await expect(page.getByText(/Penicillin/).first()).toBeVisible();
  await expect(page.getByText("Current").first()).toBeVisible();

  // Submit a second history — the first must flip to "Previous", never be overwritten.
  await page.getByRole("button", { name: "New Medical History" }).first().click();
  await answerYesNo(page, "Drug allergy", "Penicillin");
  await page.getByRole("button", { name: "Save Medical History" }).click();

  await expect(page.getByText("Previous")).toBeVisible();
  await expect(page.getByText("Current").first()).toBeVisible();
});
