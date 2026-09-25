import path from "node:path";
import { test, expect } from "./fixtures";
import { login, openPatientRecord } from "./helpers";

test("Scenario 17: uploading a document and managing a patient task", async ({ page }) => {
  await login(page);
  await openPatientRecord(page, "Sara Ali");

  await page.getByRole("link", { name: "Documents" }).click();
  await page.getByRole("button", { name: "Upload Document" }).first().click();
  const uploadDialog = page.getByRole("dialog");
  await uploadDialog.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures", "sample.png"));
  await uploadDialog.getByRole("button", { name: "Upload Document", exact: true }).click();

  await expect(page.getByText("sample.png")).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview" })).toBeVisible();

  await page.getByRole("link", { name: "Tasks" }).click();
  await page.getByRole("button", { name: "Add Task" }).first().click();
  await page.getByLabel("Task", { exact: true }).fill("Confirm insurance details");
  await page.getByRole("button", { name: "Add Task", exact: true }).click();

  const taskRow = page.locator("li", { hasText: "Confirm insurance details" });
  await expect(taskRow).toBeVisible();
  await taskRow.getByRole("combobox").selectOption({ label: "Completed" });
  await expect(taskRow.getByText("Confirm insurance details")).toHaveClass(/line-through/);
});
