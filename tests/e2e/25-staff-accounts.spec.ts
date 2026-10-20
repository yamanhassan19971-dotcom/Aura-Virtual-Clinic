import { test, expect } from "./fixtures";
import { prisma } from "./db";
import { login } from "./helpers";

const NEW_LOGIN = "raghad@aura.local";

async function cleanUp() {
  const user = await prisma.user.findUnique({ where: { email: NEW_LOGIN } });
  if (user) {
    await prisma.auditLog.deleteMany({ where: { OR: [{ userId: user.id }, { recordId: user.id }] } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  // Other spec files sign in as the manager, so never leave it locked.
  await prisma.user.update({ where: { email: "manager@aura.dev" }, data: { failedLogins: 0, lockedUntil: null } });
}

test.beforeEach(cleanUp);
test.afterEach(cleanUp);

test("Scenario 25: the Admin adds a staff member, who sets their own password at first sign-in and is signed out when switched off", async ({
  page,
  browser,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("link", { name: "Staff Accounts" }).click();
  await page.waitForURL("**/settings/staff");

  await page.getByRole("button", { name: "+ Add staff member" }).click();
  const form = page.getByRole("dialog", { name: "New staff account" });
  await form.getByLabel("Name").fill("Raghad");
  await form.getByLabel("Login").fill(NEW_LOGIN);
  await form.getByLabel("Role").selectOption("RECEPTIONIST");
  await form.getByRole("button", { name: "Create account" }).click();

  const oneTime = (await page.getByTestId("one-time-password").textContent())!.trim();
  expect(oneTime).toHaveLength(12);
  await page.getByRole("button", { name: "Done" }).click();
  const row = page.getByTestId(`staff-row-${NEW_LOGIN}`);
  await expect(row.getByText("Must set password")).toBeVisible();

  // Raghad signs in on another device with the one-time password.
  const other = await browser.newContext();
  const raghad = await other.newPage();
  await raghad.goto("/en/login");
  await raghad.getByLabel("Email").fill(NEW_LOGIN);
  await raghad.getByLabel("Password").fill(oneTime);
  await raghad.getByRole("button", { name: "Sign in" }).click();
  await expect(raghad.getByRole("heading", { name: "Choose your own password" })).toBeVisible();
  await expect(raghad.getByRole("link", { name: "Patients" })).toHaveCount(0);

  await raghad.getByLabel("One-time password").fill(oneTime);
  await raghad.getByLabel("New password", { exact: true }).fill("short");
  await raghad.getByLabel("New password again").fill("short");
  await raghad.getByRole("button", { name: "Save and continue" }).click();
  await expect(raghad.getByText("Use at least 10 characters.")).toBeVisible();

  await raghad.getByLabel("New password", { exact: true }).fill("jasmine at ten");
  await raghad.getByLabel("New password again").fill("jasmine at ten");
  await raghad.getByRole("button", { name: "Save and continue" }).click();
  await expect(raghad.getByRole("link", { name: "Patients" }).first()).toBeAttached();
  // Reception can't see the staff page.
  await raghad.goto("/en/settings/staff");
  await expect(raghad.getByText("Staff Accounts")).toHaveCount(0);

  // The Admin switches the account off; Raghad's next page load signs her out.
  await page.reload();
  await row.getByRole("button", { name: "Switch off" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Switch off" }).click();
  await expect(row.getByText("Switched off")).toBeVisible();

  await raghad.goto("/en/patients");
  await raghad.waitForURL("**/login?ended=1");
  await expect(raghad.getByText("You were signed out because your account changed.")).toBeVisible();
  await raghad.getByLabel("Email").fill(NEW_LOGIN);
  await raghad.getByLabel("Password").fill("jasmine at ten");
  await raghad.getByRole("button", { name: "Sign in" }).click();
  await expect(raghad.getByText("Incorrect email or password.")).toBeVisible();
  await other.close();
});

test("Scenario 25b: five wrong passwords lock the account and the login page says so", async ({ page }) => {
  await page.goto("/en/login");
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("Email").fill("manager@aura.dev");
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("p[role=alert]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  }
  await expect(page.getByText("This account is locked for 15 minutes")).toBeVisible();
  await page.getByLabel("Email").fill("manager@aura.dev");
  await page.getByLabel("Password").fill("Passw0rd!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("This account is locked for 15 minutes")).toBeVisible();
});
