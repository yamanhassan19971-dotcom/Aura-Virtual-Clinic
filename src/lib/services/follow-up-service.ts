import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { REVIEW_MIN_SCORE } from "@/lib/followups/schedule";
import { assertCan } from "@/lib/permissions";
import type { Actor } from "@/lib/services/actor";
import { serialize, writeAudit } from "@/lib/services/audit";
import { BusinessRuleError, InvalidTransitionError, NotFoundError } from "@/lib/services/errors";
import { scheduleReviewRequest } from "@/lib/services/follow-up-hooks";
import {
  completeFollowUpSchema,
  createFollowUpSchema,
  rescheduleFollowUpSchema,
  skipFollowUpSchema,
} from "@/lib/validation/pipeline";

type Tx = Prisma.TransactionClient;

async function loadDue(tx: Tx, practiceId: string, followUpId: string) {
  const followUp = await tx.followUp.findFirst({ where: { id: followUpId, practiceId } });
  if (!followUp) throw new NotFoundError("Follow-up not found");
  if (followUp.status !== "DUE") throw new InvalidTransitionError(followUp.status, "DONE");
  return followUp;
}

export async function completeFollowUp(actor: Actor, rawInput: unknown) {
  const input = completeFollowUpSchema.parse(rawInput);
  assertCan(actor.role, "followUps.manage");
  return prisma.$transaction(async (tx) => {
    const followUp = await loadDue(tx, actor.practiceId, input.followUpId);
    if (followUp.kind === "SATISFACTION" && !input.satisfactionScore) {
      throw new BusinessRuleError("SCORE_REQUIRED", "Record the patient's score out of 10.");
    }
    const now = new Date();
    const updated = await tx.followUp.update({
      where: { id: followUp.id },
      data: {
        status: "DONE",
        outcome: input.outcome || null,
        satisfactionScore: followUp.kind === "SATISFACTION" ? input.satisfactionScore : null,
        completedAt: now,
        completedById: actor.id,
      },
    });
    if (followUp.kind === "SATISFACTION" && (input.satisfactionScore ?? 0) >= REVIEW_MIN_SCORE) {
      await scheduleReviewRequest(tx, {
        practiceId: followUp.practiceId,
        patientId: followUp.patientId,
        planId: followUp.planId,
        createdById: actor.id,
      });
    }
    await writeAudit(tx, {
      userId: actor.id,
      action: "followUp.completed",
      recordType: "FollowUp",
      recordId: followUp.id,
      previousValue: { status: followUp.status },
      newValue: { status: "DONE", outcome: updated.outcome, satisfactionScore: updated.satisfactionScore },
    });
    return updated;
  });
}

export async function skipFollowUp(actor: Actor, rawInput: unknown) {
  const input = skipFollowUpSchema.parse(rawInput);
  assertCan(actor.role, "followUps.manage");
  return prisma.$transaction(async (tx) => {
    const followUp = await loadDue(tx, actor.practiceId, input.followUpId);
    const updated = await tx.followUp.update({
      where: { id: followUp.id },
      data: { status: "SKIPPED", outcome: input.outcome || null, completedAt: new Date(), completedById: actor.id },
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: "followUp.skipped",
      recordType: "FollowUp",
      recordId: followUp.id,
      previousValue: { status: followUp.status },
      newValue: { status: "SKIPPED", outcome: updated.outcome },
    });
    return updated;
  });
}

export async function rescheduleFollowUp(actor: Actor, rawInput: unknown) {
  const input = rescheduleFollowUpSchema.parse(rawInput);
  assertCan(actor.role, "followUps.manage");
  return prisma.$transaction(async (tx) => {
    const followUp = await loadDue(tx, actor.practiceId, input.followUpId);
    const updated = await tx.followUp.update({ where: { id: followUp.id }, data: { dueAt: input.dueAt } });
    await writeAudit(tx, {
      userId: actor.id,
      action: "followUp.rescheduled",
      recordType: "FollowUp",
      recordId: followUp.id,
      previousValue: { dueAt: followUp.dueAt },
      newValue: { dueAt: updated.dueAt },
    });
    return updated;
  });
}

/** A one-off follow-up a staff member adds by hand ("call back Thursday about the X-ray"). */
export async function createFollowUp(actor: Actor, rawInput: unknown) {
  const input = createFollowUpSchema.parse(rawInput);
  assertCan(actor.role, "followUps.manage");
  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({ where: { id: input.patientId, practiceId: actor.practiceId } });
    if (!patient) throw new NotFoundError("Patient not found");
    const followUp = await tx.followUp.create({
      data: {
        practiceId: actor.practiceId,
        patientId: patient.id,
        kind: "CUSTOM",
        channel: input.channel,
        dueAt: input.dueAt,
        note: input.note,
        createdById: actor.id,
      },
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: "followUp.created",
      recordType: "FollowUp",
      recordId: followUp.id,
      previousValue: null,
      newValue: serialize(followUp),
    });
    return followUp;
  });
}
