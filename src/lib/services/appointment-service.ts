import type { Appointment, AppointmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import type { Actor } from "@/lib/services/actor";
import { ConflictError, InvalidTransitionError, NotFoundError } from "@/lib/services/errors";
import { writeAudit } from "@/lib/services/audit";
import { encodeReason } from "@/lib/services/codec";
import {
  cancelAppointmentSchema,
  changeStatusSchema,
  createAppointmentSchema,
  ftaAppointmentSchema,
  updateAppointmentSchema,
} from "@/lib/validation/appointment";

export const APPOINTMENT_INCLUDE = {
  patient: true,
  practitioner: true,
  room: true,
  appointmentType: true,
} satisfies Prisma.AppointmentInclude;

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: typeof APPOINTMENT_INCLUDE;
}>;

const TERMINAL_STATUSES = new Set<AppointmentStatus>(["COMPLETED", "CANCELLED", "FTA"]);

const STATUS_TIMESTAMP_FIELD: Partial<Record<AppointmentStatus, "arrivedAt" | "inSurgeryAt" | "completedAt">> = {
  ARRIVED: "arrivedAt",
  IN_SURGERY: "inSurgeryAt",
  COMPLETED: "completedAt",
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Reason fields store "<CODE>::<free text notes>" so the UI can localize the
// code (via the status/cancelDialog/ftaDialog message namespaces) while
// still keeping the receptionist's free-text note, without adding a column
// that section 37 of the spec doesn't define. Re-exported here for existing
// importers; the encoding itself now lives in codec.ts since Phase 2's
// medical alerts reuse the same convention.
export { decodeReason } from "@/lib/services/codec";

function assertOwnAppointmentIfClinician(actor: Actor, appointment: Pick<Appointment, "practitionerId">) {
  if (actor.role === "CLINICIAN" && appointment.practitionerId !== actor.practitionerId) {
    throw new NotFoundError("Appointment not found");
  }
}

function serialize(appt: Appointment): Record<string, unknown> {
  return JSON.parse(JSON.stringify(appt));
}

async function findConflict(
  tx: Prisma.TransactionClient,
  params: {
    practiceId: string;
    practitionerId: string;
    roomId: string;
    startTime: Date;
    endTime: Date;
    excludeId?: string;
  }
) {
  return tx.appointment.findFirst({
    where: {
      practiceId: params.practiceId,
      id: params.excludeId ? { not: params.excludeId } : undefined,
      status: { notIn: ["CANCELLED", "FTA"] },
      OR: [{ practitionerId: params.practitionerId }, { roomId: params.roomId }],
      startTime: { lt: params.endTime },
      endTime: { gt: params.startTime },
    },
    include: { patient: true, practitioner: true },
    orderBy: { startTime: "asc" },
  });
}

async function writeHistory(
  tx: Prisma.TransactionClient,
  params: {
    appointmentId: string;
    previousStatus: AppointmentStatus | null;
    newStatus: AppointmentStatus;
    changedById: string;
    reason?: string | null;
  }
) {
  await tx.appointmentStatusHistory.create({
    data: {
      appointmentId: params.appointmentId,
      previousStatus: params.previousStatus,
      newStatus: params.newStatus,
      changedById: params.changedById,
      reason: params.reason ?? null,
    },
  });
}

function writeAppointmentAudit(
  tx: Prisma.TransactionClient,
  params: { userId: string; action: string; recordId: string; previousValue: unknown; newValue: unknown }
) {
  return writeAudit(tx, { ...params, recordType: "Appointment" });
}

async function assertReferencesBelongToPractice(
  tx: Prisma.TransactionClient,
  practiceId: string,
  refs: { patientId?: string; practitionerId?: string; roomId?: string; appointmentTypeId?: string }
) {
  if (refs.patientId) {
    const found = await tx.patient.findFirst({ where: { id: refs.patientId, practiceId } });
    if (!found) throw new NotFoundError("Patient not found");
  }
  if (refs.practitionerId) {
    const found = await tx.practitioner.findFirst({ where: { id: refs.practitionerId, practiceId } });
    if (!found) throw new NotFoundError("Practitioner not found");
  }
  if (refs.roomId) {
    const found = await tx.room.findFirst({ where: { id: refs.roomId, practiceId } });
    if (!found) throw new NotFoundError("Room not found");
  }
  if (refs.appointmentTypeId) {
    const found = await tx.appointmentType.findFirst({ where: { id: refs.appointmentTypeId, practiceId } });
    if (!found) throw new NotFoundError("Appointment type not found");
  }
}

/**
 * Creates an appointment. This — and every other export in this file — is
 * the single, transactional entry point for mutating appointments: conflict
 * detection, permission checks, status history and the audit log all happen
 * together here, never split across API routes.
 */
export async function createAppointment(actor: Actor, rawInput: unknown): Promise<AppointmentWithRelations> {
  const input = createAppointmentSchema.parse(rawInput);
  assertCan(actor.role, "appointments.create");

  const endTime = new Date(input.startTime.getTime() + input.durationMin * 60000);

  return prisma.$transaction(async (tx) => {
    await assertReferencesBelongToPractice(tx, actor.practiceId, input);

    const conflict = await findConflict(tx, {
      practiceId: actor.practiceId,
      practitionerId: input.practitionerId,
      roomId: input.roomId,
      startTime: input.startTime,
      endTime,
    });

    let conflictOverride = false;
    if (conflict) {
      if (!input.overrideConflict) throw new ConflictError(conflict);
      assertCan(actor.role, "appointments.overrideConflict");
      conflictOverride = true;
    }

    const appt = await tx.appointment.create({
      data: {
        practiceId: actor.practiceId,
        patientId: input.patientId,
        practitionerId: input.practitionerId,
        roomId: input.roomId,
        appointmentTypeId: input.appointmentTypeId,
        date: startOfDay(input.startTime),
        startTime: input.startTime,
        endTime,
        durationMin: input.durationMin,
        status: input.status,
        notes: input.notes ?? null,
        conflictOverride,
        conflictOverrideById: conflictOverride ? actor.id : null,
        conflictOverrideReason: conflictOverride ? input.overrideReason ?? null : null,
        createdById: actor.id,
      },
      include: APPOINTMENT_INCLUDE,
    });

    await writeHistory(tx, {
      appointmentId: appt.id,
      previousStatus: null,
      newStatus: appt.status,
      changedById: actor.id,
    });
    await writeAppointmentAudit(tx, {
      userId: actor.id,
      action: "appointment.created",
      recordId: appt.id,
      previousValue: null,
      newValue: serialize(appt),
    });

    return appt;
  });
}

/** Handles edit, drag-move and resize alike — they're all a schedule/detail update. */
export async function updateAppointment(actor: Actor, rawInput: unknown): Promise<AppointmentWithRelations> {
  const input = updateAppointmentSchema.parse(rawInput);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.appointment.findFirst({
      where: { id: input.appointmentId, practiceId: actor.practiceId },
    });
    if (!existing) throw new NotFoundError("Appointment not found");
    assertOwnAppointmentIfClinician(actor, existing);

    const scheduleChanged =
      input.startTime !== undefined ||
      input.durationMin !== undefined ||
      input.practitionerId !== undefined ||
      input.roomId !== undefined;
    const detailsChanged =
      input.patientId !== undefined || input.appointmentTypeId !== undefined || input.notes !== undefined;

    if (scheduleChanged) assertCan(actor.role, "appointments.move");
    if (detailsChanged) assertCan(actor.role, "appointments.edit");

    await assertReferencesBelongToPractice(tx, actor.practiceId, input);

    const nextStartTime = input.startTime ?? existing.startTime;
    const nextDuration = input.durationMin ?? existing.durationMin;
    const nextEndTime = new Date(nextStartTime.getTime() + nextDuration * 60000);
    const nextPractitionerId = input.practitionerId ?? existing.practitionerId;
    const nextRoomId = input.roomId ?? existing.roomId;

    let conflictOverride = existing.conflictOverride;
    let conflictOverrideById = existing.conflictOverrideById;
    let conflictOverrideReason = existing.conflictOverrideReason;

    if (scheduleChanged) {
      const conflict = await findConflict(tx, {
        practiceId: actor.practiceId,
        practitionerId: nextPractitionerId,
        roomId: nextRoomId,
        startTime: nextStartTime,
        endTime: nextEndTime,
        excludeId: existing.id,
      });
      if (conflict) {
        if (!input.overrideConflict) throw new ConflictError(conflict);
        assertCan(actor.role, "appointments.overrideConflict");
        conflictOverride = true;
        conflictOverrideById = actor.id;
        conflictOverrideReason = input.overrideReason ?? null;
      } else {
        conflictOverride = false;
        conflictOverrideById = null;
        conflictOverrideReason = null;
      }
    }

    const updated = await tx.appointment.update({
      where: { id: existing.id },
      data: {
        patientId: input.patientId,
        practitionerId: input.practitionerId,
        roomId: input.roomId,
        appointmentTypeId: input.appointmentTypeId,
        startTime: input.startTime,
        endTime: scheduleChanged ? nextEndTime : undefined,
        durationMin: input.durationMin,
        date: input.startTime ? startOfDay(nextStartTime) : undefined,
        notes: input.notes === undefined ? undefined : input.notes,
        conflictOverride,
        conflictOverrideById,
        conflictOverrideReason,
      },
      include: APPOINTMENT_INCLUDE,
    });

    const onlyDurationChanged =
      input.durationMin !== undefined &&
      input.startTime === undefined &&
      input.practitionerId === undefined &&
      input.roomId === undefined;
    const action = onlyDurationChanged
      ? "appointment.resized"
      : scheduleChanged
        ? "appointment.moved"
        : "appointment.edited";

    await writeAppointmentAudit(tx, {
      userId: actor.id,
      action,
      recordId: updated.id,
      previousValue: serialize(existing),
      newValue: serialize(updated),
    });

    return updated;
  });
}

export async function changeStatus(actor: Actor, rawInput: unknown): Promise<AppointmentWithRelations> {
  const input = changeStatusSchema.parse(rawInput);
  assertCan(actor.role, "appointments.statusChange");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.appointment.findFirst({
      where: { id: input.appointmentId, practiceId: actor.practiceId },
    });
    if (!existing) throw new NotFoundError("Appointment not found");
    assertOwnAppointmentIfClinician(actor, existing);
    if (TERMINAL_STATUSES.has(existing.status)) {
      throw new InvalidTransitionError(existing.status, input.status);
    }

    const now = new Date();
    const timestampField = STATUS_TIMESTAMP_FIELD[input.status];
    const data: Prisma.AppointmentUpdateInput = { status: input.status };
    if (timestampField) data[timestampField] = now;

    const updated = await tx.appointment.update({
      where: { id: existing.id },
      data,
      include: APPOINTMENT_INCLUDE,
    });

    await writeHistory(tx, {
      appointmentId: existing.id,
      previousStatus: existing.status,
      newStatus: input.status,
      changedById: actor.id,
    });
    await writeAppointmentAudit(tx, {
      userId: actor.id,
      action: "appointment.statusChanged",
      recordId: existing.id,
      previousValue: { status: existing.status },
      newValue: { status: input.status },
    });

    return updated;
  });
}

export async function cancelAppointment(actor: Actor, rawInput: unknown): Promise<AppointmentWithRelations> {
  const input = cancelAppointmentSchema.parse(rawInput);
  assertCan(actor.role, "appointments.cancel");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.appointment.findFirst({
      where: { id: input.appointmentId, practiceId: actor.practiceId },
    });
    if (!existing) throw new NotFoundError("Appointment not found");
    assertOwnAppointmentIfClinician(actor, existing);
    if (TERMINAL_STATUSES.has(existing.status)) {
      throw new InvalidTransitionError(existing.status, "CANCELLED");
    }

    const now = new Date();
    const cancellationReason = encodeReason(input.reason, input.notes);

    const updated = await tx.appointment.update({
      where: { id: existing.id },
      data: { status: "CANCELLED", cancelledAt: now, cancellationReason },
      include: APPOINTMENT_INCLUDE,
    });

    await writeHistory(tx, {
      appointmentId: existing.id,
      previousStatus: existing.status,
      newStatus: "CANCELLED",
      changedById: actor.id,
      reason: cancellationReason,
    });
    await writeAppointmentAudit(tx, {
      userId: actor.id,
      action: "appointment.cancelled",
      recordId: existing.id,
      previousValue: { status: existing.status },
      newValue: { status: "CANCELLED", cancellationReason },
    });

    return updated;
  });
}

export async function markFta(actor: Actor, rawInput: unknown): Promise<AppointmentWithRelations> {
  const input = ftaAppointmentSchema.parse(rawInput);
  assertCan(actor.role, "appointments.fta");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.appointment.findFirst({
      where: { id: input.appointmentId, practiceId: actor.practiceId },
    });
    if (!existing) throw new NotFoundError("Appointment not found");
    assertOwnAppointmentIfClinician(actor, existing);
    if (TERMINAL_STATUSES.has(existing.status)) {
      throw new InvalidTransitionError(existing.status, "FTA");
    }

    const now = new Date();
    const ftaReason = encodeReason(input.reason, input.notes);

    const updated = await tx.appointment.update({
      where: { id: existing.id },
      data: { status: "FTA", ftaAt: now, ftaReason },
      include: APPOINTMENT_INCLUDE,
    });

    await writeHistory(tx, {
      appointmentId: existing.id,
      previousStatus: existing.status,
      newStatus: "FTA",
      changedById: actor.id,
      reason: ftaReason,
    });
    await writeAppointmentAudit(tx, {
      userId: actor.id,
      action: "appointment.fta",
      recordId: existing.id,
      previousValue: { status: existing.status },
      newValue: { status: "FTA", ftaReason },
    });

    return updated;
  });
}
