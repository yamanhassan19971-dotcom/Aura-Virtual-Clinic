import { test, expect } from "./fixtures";
import { login, openPatientRecord } from "./helpers";

test("Scenario 20: the patient record switches to Arabic RTL and back to English LTR", async ({ page }) => {
  await login(page);
  await openPatientRecord(page, "Ahmed Hassan");

  await page.getByRole("button", { name: "العربية" }).click();
  await page.waitForURL("**/ar/patients/**/overview**");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByRole("link", { name: "نظرة عامة", exact: true })).toBeVisible(); // "Overview"
  await expect(page.getByRole("link", { name: "التفاصيل", exact: true })).toBeVisible(); // "Details"
  await expect(page.getByRole("link", { name: "السجل الطبي", exact: true })).toBeVisible(); // "Medical" tab
  await expect(page.getByRole("button", { name: "حجز موعد" })).toBeVisible(); // "Book Appointment"

  await page.getByRole("button", { name: "English" }).click();
  await page.waitForURL("**/en/patients/**/overview**");

  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { name: "Ahmed Hassan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Book Appointment" })).toBeVisible();
});
