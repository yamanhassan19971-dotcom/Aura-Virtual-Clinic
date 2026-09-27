import path from "node:path";
import { test, expect } from "./fixtures";
import { login, openPatientRecord, toothButton, toothSurfaceButton } from "./helpers";
import { prisma } from "./db";

test("Scenario: whole-tooth and surface charting, missing tooth, planned-to-completed, tooth history, dentition modes", async ({
  page,
}) => {
  // Registered once for the whole test so it can never race the click that
  // triggers window.confirm() inside the Clinical History tab's handleSign().
  page.on("dialog", (dialog) => dialog.accept());

  await login(page, "yaman@aura.dev", "Passw0rd!");
  await openPatientRecord(page, "Ahmed Hassan");

  await page.getByRole("link", { name: "Chart", exact: true }).click();
  await page.waitForURL("**/patients/**/chart**");
  await expect(page.getByRole("button", { name: "Odontogram" })).toBeVisible();

  // 1 & 3: open Chart, select a tooth.
  await toothButton(page, "16").click();
  await expect(page.getByText("Tooth 16")).toBeVisible();
  await expect(page.getByText("No findings charted for this tooth yet.")).toBeVisible();

  // 4 & 7: chart a whole-tooth existing restoration (a crown).
  await page.getByRole("button", { name: "+ Add Finding" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Finding / Treatment").selectOption({ label: "Crown" });
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Crown · Whole tooth")).toBeVisible();

  // 5: chart a surface-specific finding, pre-selected by clicking the
  // surface cell directly on the odontogram (not just via the modal's own dropdown).
  await toothSurfaceButton(page, "16", "MESIAL").click();
  await page.getByRole("button", { name: "+ Add Finding" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Finding / Treatment").selectOption({ label: "Filling / Restoration" });
  await expect(dialog.getByLabel("Specific surface")).toBeChecked();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Filling / Restoration · Mesial")).toBeVisible();

  // 6: mark a different tooth missing, and confirm it never deletes a row —
  // it's recorded as a chart entry, visible in that tooth's own history.
  await toothButton(page, "18").click();
  await page.getByRole("button", { name: "+ Add Finding" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Finding / Treatment").selectOption({ label: "Missing" });
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Missing · Whole tooth")).toBeVisible();

  // 8 & then completing it: chart a planned surface treatment, then mark it completed.
  await toothButton(page, "37").click();
  await page.getByRole("button", { name: "+ Add Finding" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Finding / Treatment").selectOption({ label: "Filling / Restoration" });
  await dialog.getByLabel("Specific surface").check();
  await dialog.getByRole("combobox").nth(1).selectOption({ label: "Mesial" });
  await dialog.getByLabel("Status").selectOption({ label: "Planned" });
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Planned", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark Completed" }).click();
  await expect(page.locator("li", { hasText: "Filling / Restoration · Mesial" }).getByText("Completed")).toBeVisible();

  // 9 & 10: view tooth history and add a clinical note tied to this tooth.
  await expect(page.getByText("Tooth History")).toBeVisible();
  await page.getByRole("button", { name: "+ Add Note" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Note").fill("Discussed the restoration plan with the patient.");
  await dialog.getByRole("button", { name: "Save Draft" }).click();
  await expect(page.getByText("Discussed the restoration plan")).toBeVisible();

  // 11 & 12: the note flows through the same Phase 2 clinical-notes engine —
  // it's signable and amendable from the existing Clinical History tab.
  await page.getByRole("link", { name: "Clinical History", exact: true }).click();
  const noteCard = page.locator("li", { hasText: "Discussed the restoration plan" });
  await expect(noteCard).toBeVisible();
  await noteCard.getByRole("button", { name: "Sign & Lock" }).click();
  await expect(noteCard.getByText("Signed", { exact: true })).toBeVisible();
  await noteCard.getByRole("button", { name: "Add Amendment" }).click();
  await noteCard.getByPlaceholder("Describe the correction or addition").fill("Patient confirmed tooth 37, not 47.");
  await noteCard.getByRole("button", { name: "Add Amendment" }).click();
  await expect(noteCard.getByText("Patient confirmed tooth 37")).toBeVisible();

  // 2: switch dentition modes without losing data — tooth identity is stable.
  await page.getByRole("link", { name: "Chart", exact: true }).click();
  await page.getByRole("button", { name: "Deciduous" }).click();
  await expect(toothButton(page, "84")).toBeVisible();
  await expect(toothButton(page, "16")).toHaveCount(0);
  await page.getByRole("button", { name: "Mixed" }).click();
  await expect(toothButton(page, "84")).toBeVisible();
  await expect(toothButton(page, "16")).toBeVisible();
  await page.getByRole("button", { name: "Permanent" }).click();

  // Chart History (the tooth-level filterable history section).
  await page.getByRole("button", { name: "Chart History" }).click();
  await expect(page.getByRole("cell", { name: "Missing", exact: false }).first()).toBeVisible();
  await page.getByPlaceholder("Tooth (e.g. 46)").fill("16");
  await expect(page.getByRole("cell", { name: "Missing", exact: false })).toHaveCount(0);
  await expect(page.getByText("Whole tooth", { exact: false }).first()).toBeVisible();

  // 17: audit trail — every meaningful chart mutation is recorded.
  const auditActions = await prisma.auditLog.findMany({ select: { action: true } });
  const actionNames = auditActions.map((a) => a.action);
  expect(actionNames).toContain("chart.entryCreated");
  expect(actionNames).toContain("chart.toothMarkedMissing");
  expect(actionNames).toContain("chart.entryCompleted");
  expect(actionNames).toContain("patient.noteCreated");
  expect(actionNames).toContain("patient.noteSigned");
  expect(actionNames).toContain("patient.noteAmended");

  // 18: back to the diary — Phase 1 functionality is unaffected.
  await page.getByRole("link", { name: "Back to Diary" }).click();
  await page.waitForURL("**/appointments**");
  await expect(page.getByRole("heading", { name: "Appointment Diary" })).toBeVisible();
});

test("Scenario: recording a BPE exam and viewing exam history", async ({ page }) => {
  await login(page, "yaman@aura.dev", "Passw0rd!");
  await openPatientRecord(page, "Sara Ali");
  await page.getByRole("link", { name: "Chart", exact: true }).click();

  await page.getByRole("button", { name: "BPE" }).click();
  await expect(page.getByText("No BPE exams recorded yet.")).toBeVisible();

  await page.getByLabel("Upper Right").selectOption("2");
  await page.getByLabel("Upper Anterior").selectOption("1");
  await page.getByLabel("Lower Left").selectOption("*");
  await page.getByRole("button", { name: "Save BPE Exam" }).click();

  await expect(page.getByText("No BPE exams recorded yet.")).toHaveCount(0);
  const examCard = page.locator("li").filter({ has: page.getByText("Dr Yaman Hassan") }).first();
  await expect(examCard).toBeVisible();

  const audit = await prisma.auditLog.findMany({ where: { action: "chart.bpeCreated" } });
  expect(audit.length).toBeGreaterThan(0);
});

test("Scenario: uploading a clinical image", async ({ page }) => {
  await login(page, "yaman@aura.dev", "Passw0rd!");
  await openPatientRecord(page, "Ahmed Hassan");

  await page.getByRole("link", { name: "Images", exact: true }).click();
  await page.getByRole("button", { name: "Upload Image" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures", "sample.png"));
  await dialog.getByLabel("Category").selectOption({ label: "Radiograph" });
  await dialog.getByLabel("Tooth (optional)").fill("26");
  await dialog.getByRole("button", { name: "Upload Image", exact: true }).click();

  await expect(page.getByText("sample.png")).toBeVisible();
  await expect(page.getByText("Radiograph · 26")).toBeVisible();

  const audit = await prisma.auditLog.findMany({ where: { action: "chart.imageUploaded" } });
  expect(audit.length).toBeGreaterThan(0);
});

test("Scenario: a receptionist has no clinical chart access at all", async ({ page }) => {
  await login(page, "reception@aura.dev", "Passw0rd!");
  await openPatientRecord(page, "Ahmed Hassan");

  await expect(page.locator('a:has-text("Chart")')).toHaveCount(0);
  await expect(page.locator('a:has-text("Images")')).toHaveCount(0);
  const chartResponse = await page.goto(page.url().replace(/\/overview$/, "/chart"));
  expect(chartResponse?.status()).toBe(404);
  const imagesResponse = await page.goto(page.url().replace(/\/chart$/, "/images"));
  expect(imagesResponse?.status()).toBe(404);
});

test("Scenario: a practice manager can view the chart but not author findings, BPE or images", async ({ page }) => {
  await login(page, "manager@aura.dev", "Passw0rd!");
  await openPatientRecord(page, "Ahmed Hassan");
  await page.getByRole("link", { name: "Chart", exact: true }).click();
  await page.waitForURL("**/patients/**/chart**");
  await expect(page.getByRole("button", { name: "Odontogram" })).toBeVisible();

  await toothButton(page, "16").click();
  await expect(page.getByText("Tooth 16")).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Add Finding" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "+ Add Note" })).toHaveCount(0);

  await page.getByRole("button", { name: "BPE" }).click();
  await expect(page.getByRole("button", { name: "Save BPE Exam" })).toHaveCount(0);

  await page.getByRole("link", { name: "Images", exact: true }).click();
  await page.waitForURL("**/patients/**/images**");
  await expect(page.getByRole("button", { name: "Upload Image" })).toHaveCount(0);
});

test("Scenario: the dental chart switches to Arabic RTL and back without layout breakage", async ({ page }) => {
  await login(page, "yaman@aura.dev", "Passw0rd!");
  await openPatientRecord(page, "Ahmed Hassan");
  await page.getByRole("link", { name: "Chart", exact: true }).click();
  await page.waitForURL("**/patients/**/chart**");

  await page.getByRole("button", { name: "العربية" }).click();
  await page.waitForURL("**/ar/patients/**/chart**");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("button", { name: "المخطط السني" })).toBeVisible(); // "Odontogram" section
  await expect(toothButton(page, "16")).toBeVisible();

  await toothButton(page, "16").click();
  await expect(page.getByText("السن 16")).toBeVisible(); // "Tooth 16"

  await page.getByRole("button", { name: "English" }).click();
  await page.waitForURL("**/en/patients/**/chart**");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("button", { name: "Odontogram" })).toBeVisible();
});
