import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import type { Actor } from "@/lib/services/actor";
import { writeAudit } from "@/lib/services/audit";
import { BusinessRuleError, NotFoundError } from "@/lib/services/errors";
import {
  changeOwnPasswordSchema,
  createStaffSchema,
  setStaffActiveSchema,
  staffRefSchema,
  updateStaffSchema,
} from "@/lib/validation/staff";

/** Failed sign-ins in a row before an account is locked for LOCK_MINUTES. */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

// Readable one-time passwords: no 0/O, 1/l/I, so they can be read out over
// the phone or copied from a screen without mistakes.
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateTemporaryPassword(length = 12): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += PASSWORD_ALPHABET[bytes[i] % PASSWORD_ALPHABET.length];
  return out;
}

const staffSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  mustChangePassword: true,
  lastLoginAt: true,
  lockedUntil: true,
  practitioner: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

export async function listStaff(actor: Actor) {
  assertCan(actor.role, "users.manage");
  return prisma.user.findMany({
    where: { practiceId: actor.practiceId },
    select: staffSelect,
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
  });
}

/** Doctors' diary columns and which login (if any) each is linked to. */
export async function listPractitionerLinks(actor: Actor) {
  assertCan(actor.role, "users.manage");
  return prisma.practitioner.findMany({
    where: { practiceId: actor.practiceId, active: true },
    select: { id: true, name: true, userId: true },
    orderBy: { sortOrder: "asc" },
  });
}

async function linkPractitioner(
  tx: Prisma.TransactionClient,
  actor: Actor,
  userId: string,
  practitionerId: string | null | undefined
) {
  if (practitionerId === undefined) return;
  await tx.practitioner.updateMany({ where: { userId, NOT: { id: practitionerId ?? "" } }, data: { userId: null } });
  if (!practitionerId) return;
  const practitioner = await tx.practitioner.findFirst({ where: { id: practitionerId, practiceId: actor.practiceId } });
  if (!practitioner) throw new NotFoundError("Practitioner not found");
  if (practitioner.userId && practitioner.userId !== userId) {
    throw new BusinessRuleError("PRACTITIONER_TAKEN", "That doctor already has a login.");
  }
  await tx.practitioner.update({ where: { id: practitionerId }, data: { userId } });
}

/** Creates a login with a one-time password, returned once so the admin can hand it over. */
export async function createStaff(actor: Actor, rawInput: unknown) {
  const input = createStaffSchema.parse(rawInput);
  assertCan(actor.role, "users.manage");
  if (await prisma.user.findUnique({ where: { email: input.email } })) {
    throw new BusinessRuleError("EMAIL_TAKEN", "Another account already uses this login.");
  }
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await argon2.hash(temporaryPassword);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        practiceId: actor.practiceId,
        name: input.name,
        email: input.email,
        role: input.role,
        passwordHash,
        mustChangePassword: true,
      },
      select: { id: true, name: true, email: true, role: true },
    });
    await linkPractitioner(tx, actor, created.id, canTreat(input.role) ? input.practitionerId : undefined);
    await writeAudit(tx, {
      userId: actor.id,
      action: "STAFF_CREATED",
      recordType: "User",
      recordId: created.id,
      previousValue: null,
      newValue: { name: created.name, email: created.email, role: created.role },
    });
    return tx.user.findUniqueOrThrow({ where: { id: created.id }, select: staffSelect });
  });
  return { user, temporaryPassword };
}

/** Roles whose login can be a doctor's diary column (an owner-dentist is often the Admin too). */
function canTreat(role: Role) {
  return role === "CLINICIAN" || role === "ADMIN";
}

function assertNotSelf(actor: Actor, userId: string, code: string) {
  if (actor.id === userId) throw new BusinessRuleError(code, "You can't do this to your own account.");
}

async function findStaff(tx: Prisma.TransactionClient, actor: Actor, userId: string) {
  const user = await tx.user.findFirst({ where: { id: userId, practiceId: actor.practiceId } });
  if (!user) throw new NotFoundError("Staff member not found");
  return user;
}

/** At least one active Admin must remain, or nobody could manage accounts again. */
async function assertAnotherActiveAdmin(tx: Prisma.TransactionClient, actor: Actor, userId: string) {
  const others = await tx.user.count({
    where: { practiceId: actor.practiceId, role: "ADMIN", active: true, NOT: { id: userId } },
  });
  if (others === 0) throw new BusinessRuleError("LAST_ADMIN", "The clinic needs at least one active Admin.");
}

export async function updateStaff(actor: Actor, rawInput: unknown) {
  const input = updateStaffSchema.parse(rawInput);
  assertCan(actor.role, "users.manage");
  return prisma.$transaction(async (tx) => {
    const before = await findStaff(tx, actor, input.userId);
    const roleChanged = input.role !== undefined && input.role !== before.role;
    if (roleChanged) {
      assertNotSelf(actor, input.userId, "OWN_ROLE");
      if (before.role === "ADMIN") await assertAnotherActiveAdmin(tx, actor, input.userId);
    }
    const role = input.role ?? before.role;
    const updated = await tx.user.update({
      where: { id: input.userId },
      data: {
        name: input.name,
        role,
        // A new role takes effect at the next request; signing out keeps
        // open tabs from showing screens the person can no longer use.
        ...(roleChanged ? { sessionVersion: { increment: 1 } } : {}),
      },
    });
    await linkPractitioner(tx, actor, input.userId, canTreat(role) ? input.practitionerId : null);
    await writeAudit(tx, {
      userId: actor.id,
      action: "STAFF_UPDATED",
      recordType: "User",
      recordId: input.userId,
      previousValue: { name: before.name, role: before.role },
      newValue: { name: updated.name, role: updated.role },
    });
    return tx.user.findUniqueOrThrow({ where: { id: input.userId }, select: staffSelect });
  });
}

/** Replaces a forgotten password with a one-time one and signs the person out everywhere. */
export async function resetStaffPassword(actor: Actor, rawInput: unknown) {
  const { userId } = staffRefSchema.parse(rawInput);
  assertCan(actor.role, "users.manage");
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await argon2.hash(temporaryPassword);
  await prisma.$transaction(async (tx) => {
    await findStaff(tx, actor, userId);
    await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: true,
        failedLogins: 0,
        lockedUntil: null,
        sessionVersion: { increment: 1 },
      },
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: "STAFF_PASSWORD_RESET",
      recordType: "User",
      recordId: userId,
      previousValue: null,
      newValue: null,
    });
  });
  return { temporaryPassword };
}

export async function setStaffActive(actor: Actor, rawInput: unknown) {
  const { userId, active } = setStaffActiveSchema.parse(rawInput);
  assertCan(actor.role, "users.manage");
  assertNotSelf(actor, userId, "OWN_ACTIVE");
  return prisma.$transaction(async (tx) => {
    const before = await findStaff(tx, actor, userId);
    if (!active && before.role === "ADMIN") await assertAnotherActiveAdmin(tx, actor, userId);
    const updated = await tx.user.update({
      where: { id: userId },
      data: { active, failedLogins: 0, lockedUntil: null, ...(active ? {} : { sessionVersion: { increment: 1 } }) },
      select: staffSelect,
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: active ? "STAFF_REACTIVATED" : "STAFF_DEACTIVATED",
      recordType: "User",
      recordId: userId,
      previousValue: { active: before.active },
      newValue: { active },
    });
    return updated;
  });
}

export async function changeOwnPassword(actor: Actor, rawInput: unknown) {
  const input = changeOwnPasswordSchema.parse(rawInput);
  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user) throw new NotFoundError("Account not found");
  const valid = await argon2.verify(user.passwordHash, input.currentPassword).catch(() => false);
  if (!valid) throw new BusinessRuleError("WRONG_PASSWORD", "The current password is not correct.");
  if (input.newPassword === input.currentPassword) {
    throw new BusinessRuleError("SAME_PASSWORD", "Choose a password different from the current one.");
  }
  const passwordHash = await argon2.hash(input.newPassword);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: { passwordHash, mustChangePassword: false } });
    await writeAudit(tx, {
      userId: actor.id,
      action: "PASSWORD_CHANGED",
      recordType: "User",
      recordId: actor.id,
      previousValue: null,
      newValue: null,
    });
  });
}

/**
 * Checks a password sign-in and keeps the lockout counters. A locked account
 * stays locked even for the right password until the lock ends; saying so
 * (rather than "wrong password") stops staff retrying and locking it again.
 */
export async function verifySignIn(email: string, password: string, now = new Date()) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { practitioner: true },
  });
  if (!user || !user.active) {
    // Same work as a real check, so response time doesn't reveal which logins exist.
    await argon2.verify(await dummyHash(), password).catch(() => false);
    return { status: "invalid" } as const;
  }
  if (user.lockedUntil && user.lockedUntil > now) return { status: "locked" } as const;

  const valid = await argon2.verify(user.passwordHash, password).catch(() => false);
  if (!valid) {
    const failedLogins = user.failedLogins + 1;
    const lock = failedLogins >= MAX_FAILED_LOGINS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: lock ? 0 : failedLogins,
        lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : user.lockedUntil,
      },
    });
    return lock ? ({ status: "locked" } as const) : ({ status: "invalid" } as const);
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { failedLogins: 0, lockedUntil: null, lastLoginAt: now },
  });
  return { status: "ok", user } as const;
}

// Hash of a random string nobody knows, used only to equalize timing.
let dummyHashPromise: Promise<string> | null = null;
function dummyHash() {
  dummyHashPromise ??= argon2.hash(randomBytes(16).toString("hex"));
  return dummyHashPromise;
}

/**
 * The signed-in user as the database knows them now. The session cookie is
 * a signed token that lives for weeks, so every request re-checks that the
 * account is still active and hasn't been signed out since (sessionVersion),
 * and takes the role from here rather than from the token.
 */
export async function getLiveUser(userId: string, sessionVersion: number | undefined) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      role: true,
      practiceId: true,
      active: true,
      sessionVersion: true,
      mustChangePassword: true,
      practitioner: { select: { id: true } },
    },
  });
  if (!user || !user.active || user.sessionVersion !== (sessionVersion ?? 0)) return null;
  return user;
}
