import { test, expect } from "./fixtures";
import { login, openPatientRecord } from "./helpers";

test("Scenario 16: a clinical note goes draft -> signed (frozen) -> amended, never editing signed content", async ({
  page,
}) => {
  // Registered once for the whole test so it can never race the click that
  // triggers window.confirm() inside handleSign().
  page.on("dialog", (dialog) => dialog.accept());

  await login(page);
  await openPatientRecord(page, "Ahmed Hassan");
  await page.getByRole("link", { name: "Clinical History" }).click();

  await page.getByRole("button", { name: "Add Clinical Note" }).click();
  await page.getByLabel("Practitioner").selectOption({ label: "Dr Yaman Hassan" });
  await page.getByLabel("Note", { exact: true }).fill("Routine examination. No new caries. Recall in 6 months.");
  await page.getByRole("button", { name: "Save Draft" }).click();

  const noteCard = page.locator("li", { hasText: "Routine examination" });
  await expect(noteCard.getByText("Draft")).toBeVisible();

  // Creating a note triggers a background router.refresh() (to pick up any
  // side effects) that can otherwise race a sign performed immediately
  // after — let it settle first, as a real user reviewing the draft would.
  await page.waitForLoadState("networkidle");

  await noteCard.getByRole("button", { name: "Sign & Lock" }).click();
  await expect(noteCard.getByText("Signed", { exact: true })).toBeVisible();

  // Once signed, there is no more Edit button — only an amendment path.
  await expect(noteCard.getByRole("button", { name: "Edit" })).not.toBeVisible();

  await noteCard.getByRole("button", { name: "+ Add Amendment" }).click();
  await noteCard.getByPlaceholder("Describe the correction or addition").fill("Correction: flagged for follow-up.");
  await noteCard.getByRole("button", { name: "Add Amendment", exact: true }).click();

  await expect(noteCard.getByText("Correction: flagged for follow-up.")).toBeVisible();
  // The original signed content is still there, untouched by the amendment.
  await expect(noteCard.getByText("Routine examination. No new caries. Recall in 6 months.")).toBeVisible();
});
