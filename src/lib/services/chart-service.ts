import { prisma } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import type { Actor } from "@/lib/services/actor";
import { serialize, writeAudit } from "@/lib/services/audit";
import { InvalidTransitionError, NotFoundError } from "@/lib/services/errors";
import { dentitionTypeForTooth } from "@/lib/dental/teeth";
import { completeChartEntrySchema, createChartEntrySchema, retractChartEntrySchema } from "@/lib/validation/chart";
import type { Prisma } from "@prisma/client";

// Shared with patient-queries.ts, mirroring APPOINTMENT_INCLUDE in
// appointment-service.ts — the one place the ChartEntry relation shape is
// defined, reused by every query and mutation that returns a row.
export const CHART_ENTRY_INCLUDE = {
  practitioner: { select: { name: true } },
  createdBy: { select: { name: true } },
  resolvedBy: { select: { name: true } },
  appointment: { include: { appointmentType: true } },
} satisfies Prisma.ChartEntryInclude;

export type ChartEntryWithRelations = Prisma.ChartEntryGetPayload<{ include: typeof CHART_ENTRY_INCLUDE }>;

/**
 * A single structured fact charted against a tooth (or one surface of a
 * tooth): a base/existing condition, a planned treatment, or a completed
 * treatment. Rows are never deleted — retracting an entry sets
 * active=false/resolvedAt (mirrors resolveAlert/resolveFlag below), and a
 * PLANNED entry becomes COMPLETED via an audited update to the same row, so
 * the tooth's history is always reconstructable from this table alone.
 */
export async function createChartEntry(actor: Actor, rawInput: unknown) {
  const input = createChartEntrySchema.parse(rawInput);
  assertCan(actor.role, "patients.manageClinicalChart");

  const dentitionType = dentitionTypeForTooth(input.toothNumber);
  if (!dentitionType) throw new NotFoundError("Unknown tooth number.");

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({ where: { id: input.patientId, practiceId: actor.practiceId } });
    if (!patient) throw new NotFoundError("Patient not found");

    if (input.practitionerId) {
      const practitioner = await tx.practitioner.findFirst({
        where: { id: input.practitionerId, practiceId: actor.practiceId },
      });
      if (!practitioner) throw new NotFoundError("Practitioner not found");
    }

    const entry = await tx.chartEntry.create({
      data: {
        practiceId: actor.practiceId,
        patientId: input.patientId,
        toothNumber: input.toothNumber,
        dentitionType,
        surface: input.surface ?? null,
        itemCode: input.itemCode,
        status: input.status,
        recordedDate: input.recordedDate ?? new Date(),
        practitionerId: input.practitionerId ?? actor.practitionerId ?? null,
        appointmentId: input.appointmentId ?? null,
        note: input.note ?? null,
        completedAt: input.status === "COMPLETED" ? new Date() : null,
        createdById: actor.id,
      },
    });

    await writeAudit(tx, {
      userId: actor.id,
      action: input.itemCode === "MISSING" ? "chart.toothMarkedMissing" : "chart.entryCreated",
      recordType: "ChartEntry",
      recordId: entry.id,
      previousValue: null,
      newValue: serialize(entry),
    });

    return entry;
  });
}

/** Only a PLANNED entry can be completed — charting a treatment directly as COMPLETED doesn't go through this. */
export async function completeChartEntry(actor: Actor, rawInput: unknown) {
  const input = completeChartEntrySchema.parse(rawInput);
  assertCan(actor.role, "patients.manageClinicalChart");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.chartEntry.findFirst({
      where: { id: input.chartEntryId, practiceId: actor.practiceId },
    });
    if (!existing || !existing.active) throw new NotFoundError("Chart entry not found");
    if (existing.status !== "PLANNED") {
      throw new InvalidTransitionError(existing.status, "COMPLETED");
    }

    const completedAt = input.completedDate ?? new Date();
    const updated = await tx.chartEntry.update({
      where: { id: input.chartEntryId },
      data: {
        status: "COMPLETED",
        completedAt,
        recordedDate: completedAt,
        note: input.note ?? existing.note,
      },
    });

    await writeAudit(tx, {
      userId: actor.id,
      action: "chart.entryCompleted",
      recordType: "ChartEntry",
      recordId: existing.id,
      previousValue: { status: existing.status },
      newValue: { status: "COMPLETED", completedAt },
    });

    return updated;
  });
}

/** Retracts (soft-removes) an entry without deleting it — e.g. a missing-tooth entry corrected, or a plan abandoned. */
export async function retractChartEntry(actor: Actor, rawInput: unknown) {
  const input = retractChartEntrySchema.parse(rawInput);
  assertCan(actor.role, "patients.manageClinicalChart");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.chartEntry.findFirst({
      where: { id: input.chartEntryId, practiceId: actor.practiceId },
    });
    if (!existing || !existing.active) throw new NotFoundError("Chart entry not found");

    const updated = await tx.chartEntry.update({
      where: { id: input.chartEntryId },
      data: {
        active: false,
        resolvedAt: new Date(),
        resolvedById: actor.id,
        note: input.reason ? `${existing.note ?? ""}${existing.note ? " — " : ""}${input.reason}` : existing.note,
      },
    });

    await writeAudit(tx, {
      userId: actor.id,
      action: "chart.entryRetracted",
      recordType: "ChartEntry",
      recordId: existing.id,
      previousValue: { active: true },
      newValue: { active: false, reason: input.reason ?? null },
    });

    return updated;
  });
}
