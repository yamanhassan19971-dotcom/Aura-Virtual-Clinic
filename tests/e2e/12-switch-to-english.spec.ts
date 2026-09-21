import { test, expect } from "./fixtures";
import { login } from "./helpers";

test("Scenario 12: switching Arabic back to English flips the layout to LTR", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "العربية" }).click();
  await page.waitForURL("**/ar/appointments**");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await page.getByRole("button", { name: "English" }).click();
  await page.waitForURL("**/en/appointments**");

  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Appointment Diary" })).toBeVisible();
  await expect(page.getByText("Waiting Room")).toBeVisible();
});
