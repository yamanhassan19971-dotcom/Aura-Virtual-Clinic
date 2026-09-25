import { prisma } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import type { Actor } from "@/lib/services/actor";
import { serialize, writeAudit } from "@/lib/services/audit";
import { encodeReason } from "@/lib/services/codec";
import { NotFoundError } from "@/lib/services/errors";
import { MEDICAL_QUESTION_BY_KEY } from "@/lib/medical/question-catalog";
import { addMedicalAlertSchema, resolveMedicalAlertSchema, submitMedicalHistorySchema } from "@/lib/validation/medical";

/**
 * Records a new medical-history submission. Never edits an existing
 * history in place: the current CURRENT row (if any) is flipped to
 * PREVIOUS in the same transaction as the new row is created, so nothing
 * is ever silently overwritten (spec section 21/22 — versioning + locking).
 *
 * Any flagged YES_NO answer (or flagged SELECT value) reaffirms/creates a
 * MedicalAlert. Alerts are never auto-resolved by a later submission —
 * resolving one is always an explicit action (resolveMedicalAlert).
 */
export async function submitMedicalHistory(actor: Actor, rawInput: unknown) {
  const input = submitMedicalHistorySchema.parse(rawInput);
  assertCan(actor.role, "patients.manageMedicalHistory");

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({ where: { id: input.patientId, practiceId: actor.practiceId } });
    if (!patient) throw new NotFoundError("Patient not found");

    await tx.medicalHistory.updateMany({
      where: { patientId: input.patientId, status: "CURRENT" },
      data: { status: "PREVIOUS" },
    });

    const history = await tx.medicalHistory.create({
      data: {
        patientId: input.patientId,
        status: "CURRENT",
        completedById: actor.id,
        notes: input.notes ?? null,
      },
    });

    const alertCodesToRaise = new Set<string>();

    for (const ans of input.answers) {
      const def = MEDICAL_QUESTION_BY_KEY.get(ans.questionKey);
      if (!def) continue; // ignore unknown keys defensively rather than failing the whole submission

      await tx.medicalHistoryAnswer.create({
        data: {
          medicalHistoryId: history.id,
          category: def.category,
          questionKey: def.key,
          answer: def.type === "YES_NO" ? (ans.answer ?? null) : null,
          freeText: ans.freeText ?? null,
        },
      });

      const triggersAlert =
        (def.type === "YES_NO" && def.alertOnYes && ans.answer === "YES") ||
        (def.type === "SELECT" && def.alertOnValues?.includes(ans.freeText ?? ""));

      if (triggersAlert) {
        alertCodesToRaise.add(encodeReason(def.key, ans.freeText));
      }
    }

    for (const label of alertCodesToRaise) {
      const code = label.split("::")[0];
      const alreadyActive = await tx.medicalAlert.findFirst({
        where: { patientId: input.patientId, active: true, label: { startsWith: code } },
      });
      if (alreadyActive) continue;

      const alert = await tx.medicalAlert.create({
        data: { patientId: input.patientId, medicalHistoryId: history.id, label, createdById: actor.id },
      });
      await writeAudit(tx, {
        userId: actor.id,
        action: "patient.alertAdded",
        recordType: "Patient",
        recordId: input.patientId,
        previousValue: null,
        newValue: serialize(alert),
      });
    }

    await writeAudit(tx, {
      userId: actor.id,
      action: "patient.medicalHistoryCreated",
      recordType: "Patient",
      recordId: input.patientId,
      previousValue: null,
      newValue: { medicalHistoryId: history.id },
    });

    return tx.medicalHistory.findUniqueOrThrow({ where: { id: history.id }, include: { answers: true } });
  });
}

export async function addMedicalAlert(actor: Actor, rawInput: unknown) {
  const input = addMedicalAlertSchema.parse(rawInput);
  assertCan(actor.role, "patients.manageAlerts");

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({ where: { id: input.patientId, practiceId: actor.practiceId } });
    if (!patient) throw new NotFoundError("Patient not found");

    const alert = await tx.medicalAlert.create({
      data: { patientId: input.patientId, label: input.label, createdById: actor.id },
    });

    await writeAudit(tx, {
      userId: actor.id,
      action: "patient.alertAdded",
      recordType: "Patient",
      recordId: input.patientId,
      previousValue: null,
      newValue: serialize(alert),
    });

    return alert;
  });
}

export async function resolveMedicalAlert(actor: Actor, rawInput: unknown) {
  const input = resolveMedicalAlertSchema.parse(rawInput);
  assertCan(actor.role, "patients.manageAlerts");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.medicalAlert.findFirst({ where: { id: input.alertId }, include: { patient: true } });
    if (!existing || existing.patient.practiceId !== actor.practiceId) {
      throw new NotFoundError("Alert not found");
    }

    const updated = await tx.medicalAlert.update({
      where: { id: input.alertId },
      data: { active: false, resolvedAt: new Date(), resolvedById: actor.id },
    });

    await writeAudit(tx, {
      userId: actor.id,
      action: "patient.alertRemoved",
      recordType: "Patient",
      recordId: existing.patientId,
      previousValue: serialize(existing),
      newValue: serialize(updated),
    });

    return updated;
  });
}
