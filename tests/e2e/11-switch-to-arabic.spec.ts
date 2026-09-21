import { test, expect } from "./fixtures";
import { login } from "./helpers";

test("Scenario 11: switching English to Arabic flips the layout to RTL", async ({ page }) => {
  await login(page);

  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

  await page.getByRole("button", { name: "العربية" }).click();
  await page.waitForURL("**/ar/appointments**");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByRole("heading", { name: "دفتر المواعيد" })).toBeVisible(); // "Appointment Diary"
  await expect(page.getByText("غرفة الانتظار")).toBeVisible(); // "Waiting Room"
});
