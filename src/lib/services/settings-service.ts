import { prisma } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import type { Actor } from "@/lib/services/actor";
import { NotFoundError } from "@/lib/services/errors";
import {
  createAppointmentTypeSchema,
  createPractitionerSchema,
  setWorkingHoursSchema,
  updateAppointmentTypeSchema,
  updatePractitionerSchema,
} from "@/lib/validation/settings";

export async function listAllPractitioners(practiceId: string) {
  return prisma.practitioner.findMany({ where: { practiceId }, orderBy: { sortOrder: "asc" } });
}

export async function createPractitioner(actor: Actor, rawInput: unknown) {
  const input = createPractitionerSchema.parse(rawInput);
  assertCan(actor.role, "settings.manage");
  const count = await prisma.practitioner.count({ where: { practiceId: actor.practiceId } });
  return prisma.practitioner.create({
    data: { ...input, practiceId: actor.practiceId, sortOrder: count },
  });
}

export async function updatePractitioner(actor: Actor, rawInput: unknown) {
  const input = updatePractitionerSchema.parse(rawInput);
  assertCan(actor.role, "settings.manage");
  const existing = await prisma.practitioner.findFirst({
    where: { id: input.practitionerId, practiceId: actor.practiceId },
  });
  if (!existing) throw new NotFoundError("Practitioner not found");
  const { practitionerId, ...data } = input;
  return prisma.practitioner.update({ where: { id: practitionerId }, data });
}

export async function listAllAppointmentTypes(practiceId: string) {
  return prisma.appointmentType.findMany({ where: { practiceId }, orderBy: { sortOrder: "asc" } });
}

export async function createAppointmentType(actor: Actor, rawInput: unknown) {
  const input = createAppointmentTypeSchema.parse(rawInput);
  assertCan(actor.role, "settings.manage");
  const count = await prisma.appointmentType.count({ where: { practiceId: actor.practiceId } });
  return prisma.appointmentType.create({
    data: { ...input, practiceId: actor.practiceId, sortOrder: count },
  });
}

export async function updateAppointmentType(actor: Actor, rawInput: unknown) {
  const input = updateAppointmentTypeSchema.parse(rawInput);
  assertCan(actor.role, "settings.manage");
  const existing = await prisma.appointmentType.findFirst({
    where: { id: input.appointmentTypeId, practiceId: actor.practiceId },
  });
  if (!existing) throw new NotFoundError("Appointment type not found");
  const { appointmentTypeId, ...data } = input;
  return prisma.appointmentType.update({ where: { id: appointmentTypeId }, data });
}

export async function listAllWorkingHours(practiceId: string) {
  return prisma.workingHours.findMany({
    where: { practiceId, practitionerId: null },
    orderBy: { weekday: "asc" },
  });
}

export async function setWorkingHours(actor: Actor, rawInput: unknown) {
  const input = setWorkingHoursSchema.parse(rawInput);
  assertCan(actor.role, "settings.manage");

  const existing = await prisma.workingHours.findFirst({
    where: { practiceId: actor.practiceId, practitionerId: null, weekday: input.weekday },
  });

  if (input.closed) {
    if (existing) await prisma.workingHours.delete({ where: { id: existing.id } });
    return null;
  }

  if (existing) {
    return prisma.workingHours.update({
      where: { id: existing.id },
      data: { startMinute: input.startMinute, endMinute: input.endMinute },
    });
  }
  return prisma.workingHours.create({
    data: {
      practiceId: actor.practiceId,
      weekday: input.weekday,
      startMinute: input.startMinute,
      endMinute: input.endMinute,
    },
  });
}
