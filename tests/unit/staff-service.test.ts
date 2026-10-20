import { describe, expect, it } from "vitest";
import argon2 from "argon2";
import { prisma } from "@/lib/db";
import { resetDb, seedFixture } from "./fixtures";
import {
  LOCK_MINUTES,
  MAX_FAILED_LOGINS,
  changeOwnPassword,
  createStaff,
  generateTemporaryPassword,
  getLiveUser,
  resetStaffPassword,
  setStaffActive,
  updateStaff,
  verifySignIn,
} from "@/lib/services/staff-service";
import { PermissionError } from "@/lib/permissions";
import { BusinessRuleError } from "@/lib/services/errors";

async function fixture() {
  await resetDb();
  return seedFixture();
}

async function ruleCode(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (e) => e
  );
  expect(error).toBeInstanceOf(BusinessRuleError);
  return (error as BusinessRuleError).code;
}

describe("staff accounts", () => {
  it("creates an account with a one-time password that must be changed at first sign-in", async () => {
    const { actors } = await fixture();
    const { user, temporaryPassword } = await createStaff(actors.admin, {
      name: "رغد",
      email: " Raghad@AURA.local ",
      role: "RECEPTIONIST",
    });
    expect(user.email).toBe("raghad@aura.local");
    expect(user.mustChangePassword).toBe(true);
    expect(temporaryPassword).toMatch(/^[a-zA-Z2-9]{12}$/);
    expect(temporaryPassword).not.toMatch(/[01lIO]/);

    const signIn = await verifySignIn("raghad@aura.local", temporaryPassword);
    expect(signIn.status).toBe("ok");

    const audit = await prisma.auditLog.findFirst({ where: { action: "STAFF_CREATED", recordId: user.id } });
    expect(audit?.userId).toBe(actors.admin.id);
  });

  it("only an Admin can manage accounts", async () => {
    const { actors } = await fixture();
    for (const actor of [actors.manager, actors.reception, actors.clinicianA]) {
      await expect(createStaff(actor, { name: "X", email: "x@aura.local", role: "ADMIN" })).rejects.toThrow(
        PermissionError
      );
    }
  });

  it("refuses a login that's already used and a doctor that already has a login", async () => {
    const { actors, drA } = await fixture();
    expect(await ruleCode(createStaff(actors.admin, { name: "X", email: "admin@test.local", role: "RECEPTIONIST" }))).toBe(
      "EMAIL_TAKEN"
    );
    expect(
      await ruleCode(
        createStaff(actors.admin, { name: "X", email: "x@aura.local", role: "CLINICIAN", practitionerId: drA.id })
      )
    ).toBe("PRACTITIONER_TAKEN");
  });

  it("links a doctor's diary column to an Admin login, and unlinks it when the role can't treat", async () => {
    const { actors, drB } = await fixture();
    const { user } = await createStaff(actors.admin, {
      name: "يمان حسن",
      email: "yaman@aura.local",
      role: "ADMIN",
      practitionerId: drB.id,
    });
    expect(user.practitioner?.id).toBe(drB.id);
    const updated = await updateStaff(actors.admin, { userId: user.id, role: "RECEPTIONIST" });
    expect(updated.role).toBe("RECEPTIONIST");
    expect((await prisma.practitioner.findUnique({ where: { id: drB.id } }))?.userId).toBeNull();
  });

  it("keeps at least one active Admin and stops an Admin changing or switching off their own account", async () => {
    const { actors } = await fixture();
    expect(await ruleCode(updateStaff(actors.admin, { userId: actors.admin.id, role: "RECEPTIONIST" }))).toBe("OWN_ROLE");
    expect(await ruleCode(setStaffActive(actors.admin, { userId: actors.admin.id, active: false }))).toBe("OWN_ACTIVE");

    const { user: second } = await createStaff(actors.admin, { name: "Second", email: "two@aura.local", role: "ADMIN" });
    const secondActor = { ...actors.admin, id: second.id };
    // With two Admins one may demote the other, but not the last one left.
    await updateStaff(secondActor, { userId: actors.admin.id, role: "PRACTICE_MANAGER" });
    await prisma.user.update({ where: { id: actors.admin.id }, data: { role: "ADMIN" } });
    await setStaffActive(actors.admin, { userId: second.id, active: false });
    await prisma.user.update({ where: { id: second.id }, data: { active: true } });
    await prisma.user.update({ where: { id: actors.admin.id }, data: { active: false } });
    expect(await ruleCode(setStaffActive(actors.admin, { userId: second.id, active: false }))).toBe("LAST_ADMIN");
  });

  it("signs a person out everywhere when their role changes, their password is reset, or they're switched off", async () => {
    const { actors } = await fixture();
    const live = async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: actors.reception.id } });
      return user.sessionVersion;
    };
    const v0 = await live();
    expect(await getLiveUser(actors.reception.id, v0)).not.toBeNull();

    await updateStaff(actors.admin, { userId: actors.reception.id, name: "Renamed" });
    expect(await live()).toBe(v0); // a rename alone doesn't sign anyone out

    await updateStaff(actors.admin, { userId: actors.reception.id, role: "PRACTICE_MANAGER" });
    expect(await getLiveUser(actors.reception.id, v0)).toBeNull();
    const v1 = await live();

    const { temporaryPassword } = await resetStaffPassword(actors.admin, { userId: actors.reception.id });
    expect(await getLiveUser(actors.reception.id, v1)).toBeNull();
    const v2 = await live();
    expect((await getLiveUser(actors.reception.id, v2))?.mustChangePassword).toBe(true);
    expect((await verifySignIn("reception@test.local", temporaryPassword)).status).toBe("ok");

    await setStaffActive(actors.admin, { userId: actors.reception.id, active: false });
    expect(await getLiveUser(actors.reception.id, v2)).toBeNull();
    expect(await getLiveUser(actors.reception.id, await live())).toBeNull(); // inactive
    expect((await verifySignIn("reception@test.local", temporaryPassword)).status).toBe("invalid");
  });
});

describe("sign-in lockout", () => {
  it(`locks an account for ${LOCK_MINUTES} minutes after ${MAX_FAILED_LOGINS} wrong passwords in a row`, async () => {
    const { actors } = await fixture();
    await prisma.user.update({
      where: { id: actors.reception.id },
      data: { passwordHash: await argon2.hash("right-password") },
    });
    const now = new Date(2026, 9, 20, 10);
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
      expect((await verifySignIn("reception@test.local", "wrong", now)).status).toBe("invalid");
    }
    expect((await verifySignIn("reception@test.local", "wrong", now)).status).toBe("locked");
    // Even the right password waits until the lock ends.
    expect((await verifySignIn("reception@test.local", "right-password", now)).status).toBe("locked");
    const later = new Date(now.getTime() + (LOCK_MINUTES + 1) * 60_000);
    expect((await verifySignIn("reception@test.local", "right-password", later)).status).toBe("ok");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: actors.reception.id } });
    expect(user.failedLogins).toBe(0);
    expect(user.lastLoginAt).toEqual(later);
  });

  it("a right password resets the count, and an Admin's reset unlocks the account", async () => {
    const { actors } = await fixture();
    await prisma.user.update({ where: { id: actors.reception.id }, data: { passwordHash: await argon2.hash("pw-12345678") } });
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) await verifySignIn("reception@test.local", "wrong");
    expect((await verifySignIn("reception@test.local", "pw-12345678")).status).toBe("ok");
    expect((await verifySignIn("reception@test.local", "wrong")).status).toBe("invalid");

    for (let i = 0; i < MAX_FAILED_LOGINS; i++) await verifySignIn("reception@test.local", "wrong");
    const { temporaryPassword } = await resetStaffPassword(actors.admin, { userId: actors.reception.id });
    expect((await verifySignIn("reception@test.local", temporaryPassword)).status).toBe("ok");
  });

  it("an unknown login is simply invalid", async () => {
    await fixture();
    expect((await verifySignIn("nobody@aura.local", "whatever")).status).toBe("invalid");
  });
});

describe("changing your own password", () => {
  it("needs the current password, a different new one, and clears the first-sign-in flag", async () => {
    const { actors } = await fixture();
    const { temporaryPassword } = await resetStaffPassword(actors.admin, { userId: actors.reception.id });
    const input = (currentPassword: string, newPassword: string) => ({
      currentPassword,
      newPassword,
      confirmPassword: newPassword,
    });
    expect(await ruleCode(changeOwnPassword(actors.reception, input("wrong", "a-new-password")))).toBe("WRONG_PASSWORD");
    expect(await ruleCode(changeOwnPassword(actors.reception, input(temporaryPassword, temporaryPassword)))).toBe(
      "SAME_PASSWORD"
    );
    await expect(changeOwnPassword(actors.reception, input(temporaryPassword, "short"))).rejects.toThrow();
    await expect(
      changeOwnPassword(actors.reception, {
        currentPassword: temporaryPassword,
        newPassword: "a-new-password",
        confirmPassword: "a-different-one",
      })
    ).rejects.toThrow();

    await changeOwnPassword(actors.reception, input(temporaryPassword, "a-new-password"));
    const user = await prisma.user.findUniqueOrThrow({ where: { id: actors.reception.id } });
    expect(user.mustChangePassword).toBe(false);
    expect((await verifySignIn("reception@test.local", "a-new-password")).status).toBe("ok");
  });

  it("generates readable one-time passwords", () => {
    const passwords = new Set(Array.from({ length: 50 }, () => generateTemporaryPassword()));
    expect(passwords.size).toBe(50);
  });
});
