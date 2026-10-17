import { test, expect } from "./fixtures";
import { login, openPatientRecord } from "./helpers";

test("Scenario 22: a doctor builds a plan, the patient accepts, reception takes a deposit above the suggested 5% and a payment", async ({
  page: doctorPage,
  browser,
}) => {
  let page = doctorPage;
  // Doctor builds and presents the plan.
  await login(page, "yaman@aura.dev");
  await openPatientRecord(page, "Ahmed Hassan");
  await page.getByRole("main").getByRole("link", { name: "Treatment Plans" }).click();
  await page.getByRole("button", { name: "New treatment plan" }).click();
  await page.getByLabel("Plan title").fill("Lower implants");
  await page.getByRole("button", { name: "Create plan" }).click();

  const plan = page.locator('section[data-testid^="plan-"]', { hasText: "Lower implants" });
  await expect(plan).toBeVisible();
  await plan.getByLabel("From price list").selectOption({ label: "Root implant · $200" });
  await plan.getByLabel("Qty").fill("2");
  await plan.getByRole("button", { name: "Add treatment" }).click();
  await expect(plan.getByRole("cell", { name: "$400" }).first()).toBeVisible();
  await plan.getByRole("button", { name: "Mark as presented" }).click();
  await expect(plan.getByText("Presented")).toBeVisible();

  // Reception records the patient's yes and takes money.
  // A separate browser session, as on the reception desk's own computer.
  page = await (await browser.newContext()).newPage();
  await login(page, "reception@aura.dev");
  await openPatientRecord(page, "Ahmed Hassan");
  await page.getByRole("main").getByRole("link", { name: "Treatment Plans" }).click();
  const receptionPlan = page.locator('section[data-testid^="plan-"]', { hasText: "Lower implants" });
  await receptionPlan.getByRole("button", { name: "Patient accepted" }).click();
  await expect(receptionPlan.getByText("Accepted", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Account" }).click();
  await page.getByRole("button", { name: "Record payment" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Type").selectOption("DEPOSIT");
  // $400 plan: 5% ($20) is only suggested, so a larger $25 deposit is accepted.
  await expect(dialog.getByText("About 5% ($20) shows commitment")).toBeVisible();
  await dialog.getByLabel("Amount").fill("25");
  await dialog.getByRole("button", { name: "Record payment" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByRole("dialog").getByLabel("Amount").fill("175");
  await page.getByRole("dialog").getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // $400 accepted, $200 paid: stage 1 (50%) settled, $200 due.
  await expect(page.getByText("R-000002")).toBeVisible();
  await expect(page.locator("div", { hasText: /^Balance due\$200$/ })).toBeVisible();
});
