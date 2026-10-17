import type { Prisma, TreatmentPlanStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertCan } from "@/lib/permissions";
import type { Actor } from "@/lib/services/actor";
import { serialize, writeAudit } from "@/lib/services/audit";
import { BusinessRuleError, InvalidTransitionError, NotFoundError } from "@/lib/services/errors";
import { onPlanStatusChanged } from "@/lib/services/follow-up-hooks";
import {
  planBalance,
  planTotalCents,
  refundDueBy,
  toUsdCents,
} from "@/lib/billing/money";
import {
  addPlanItemSchema,
  changePlanStatusSchema,
  createCatalogItemSchema,
  createPlanSchema,
  planItemRefSchema,
  processRefundSchema,
  recordPaymentSchema,
  requestRefundSchema,
  updateCatalogItemSchema,
  updatePlanSchema,
  voidPaymentSchema,
  type PlanAction,
} from "@/lib/validation/billing";

// Rounding tolerance when an SYP payment converts to slightly more than the
// USD balance — one dollar, so a fully-settling SYP payment is never refused.
const OVERPAYMENT_TOLERANCE_CENTS = 100;

const EDITABLE_PLAN_STATUSES: TreatmentPlanStatus[] = ["DRAFT", "PRESENTED"];
const ACTIVE_PLAN_STATUSES: TreatmentPlanStatus[] = ["ACCEPTED", "IN_PROGRESS"];

type Tx = Prisma.TransactionClient;

async function nextSequence(tx: Tx, kind: "plan" | "receipt"): Promise<string> {
  const prefix = kind === "plan" ? "TP-" : "R-";
  const last =
    kind === "plan"
      ? await tx.treatmentPlan.findFirst({ orderBy: { planNumber: "desc" }, select: { planNumber: true } })
      : await tx.payment.findFirst({ orderBy: { receiptNumber: "desc" }, select: { receiptNumber: true } });
  const lastValue = last ? ("planNumber" in last ? last.planNumber : last.receiptNumber) : null;
  const lastNumber = lastValue ? parseInt(lastValue.replace(/\D/g, ""), 10) : 0;
  return `${prefix}${String(lastNumber + 1).padStart(6, "0")}`;
}

async function loadPlan(tx: Tx, practiceId: string, planId: string) {
  const plan = await tx.treatmentPlan.findFirst({
    where: { id: planId, practiceId },
    include: { items: true, payments: true, refundRequests: true },
  });
  if (!plan) throw new NotFoundError("Treatment plan not found");
  return plan;
}

function assertEditable(status: TreatmentPlanStatus) {
  if (!EDITABLE_PLAN_STATUSES.includes(status)) {
    throw new BusinessRuleError(
      "PLAN_LOCKED",
      "This plan has already been accepted or closed, so its items and prices can no longer be changed."
    );
  }
}

// ---------------------------------------------------------------------------
// Price list
// ---------------------------------------------------------------------------

export async function createCatalogItem(actor: Actor, rawInput: unknown) {
  const input = createCatalogItemSchema.parse(rawInput);
  assertCan(actor.role, "settings.manage");
  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.treatmentCatalogItem.findFirst({
      where: { practiceId: actor.practiceId, code: input.code },
    });
    if (duplicate) throw new BusinessRuleError("DUPLICATE_CODE", "A treatment with this code already exists.");
    const count = await tx.treatmentCatalogItem.count({ where: { practiceId: actor.practiceId } });
    const item = await tx.treatmentCatalogItem.create({
      data: { ...input, priceNote: input.priceNote ?? null, practiceId: actor.practiceId, sortOrder: count },
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: "catalog.itemCreated",
      recordType: "TreatmentCatalogItem",
      recordId: item.id,
      previousValue: null,
      newValue: serialize(item),
    });
    return item;
  });
}

export async function updateCatalogItem(actor: Actor, rawInput: unknown) {
  const input = updateCatalogItemSchema.parse(rawInput);
  assertCan(actor.role, "settings.manage");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.treatmentCatalogItem.findFirst({
      where: { id: input.catalogItemId, practiceId: actor.practiceId },
    });
    if (!existing) throw new NotFoundError("Treatment not found");
    const { catalogItemId, ...data } = input;
    const updated = await tx.treatmentCatalogItem.update({ where: { id: catalogItemId }, data });
    await writeAudit(tx, {
      userId: actor.id,
      action: "catalog.itemUpdated",
      recordType: "TreatmentCatalogItem",
      recordId: existing.id,
      previousValue: serialize(existing),
      newValue: serialize(updated),
    });
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Treatment plans
// ---------------------------------------------------------------------------

export async function createPlan(actor: Actor, rawInput: unknown) {
  const input = createPlanSchema.parse(rawInput);
  assertCan(actor.role, "treatmentPlans.manage");

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({ where: { id: input.patientId, practiceId: actor.practiceId } });
    if (!patient) throw new NotFoundError("Patient not found");
    const practitionerId = input.practitionerId ?? actor.practitionerId ?? null;
    if (practitionerId) {
      const practitioner = await tx.practitioner.findFirst({ where: { id: practitionerId, practiceId: actor.practiceId } });
      if (!practitioner) throw new NotFoundError("Practitioner not found");
    }

    const plan = await tx.treatmentPlan.create({
      data: {
        practiceId: actor.practiceId,
        patientId: input.patientId,
        practitionerId,
        planNumber: await nextSequence(tx, "plan"),
        title: input.title,
        notes: input.notes ?? null,
        createdById: actor.id,
      },
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: "plan.created",
      recordType: "TreatmentPlan",
      recordId: plan.id,
      previousValue: null,
      newValue: serialize(plan),
    });
    return plan;
  });
}

export async function updatePlan(actor: Actor, rawInput: unknown) {
  const input = updatePlanSchema.parse(rawInput);
  assertCan(actor.role, "treatmentPlans.manage");

  return prisma.$transaction(async (tx) => {
    const plan = await loadPlan(tx, actor.practiceId, input.planId);
    // Title, notes and practitioner can change any time; anything that
    // changes what the patient owes is frozen once the plan is accepted.
    if (input.discountCents !== undefined || input.stagePercents !== undefined) assertEditable(plan.status);
    if (input.discountCents !== undefined) {
      const subtotal = planTotalCents(plan.items, 0);
      if (input.discountCents > subtotal) {
        throw new BusinessRuleError("DISCOUNT_TOO_LARGE", "The discount can't be more than the plan total.");
      }
    }
    if (input.practitionerId) {
      const practitioner = await tx.practitioner.findFirst({ where: { id: input.practitionerId, practiceId: actor.practiceId } });
      if (!practitioner) throw new NotFoundError("Practitioner not found");
    }

    const updated = await tx.treatmentPlan.update({
      where: { id: plan.id },
      data: {
        title: input.title,
        notes: input.notes === undefined ? undefined : input.notes,
        practitionerId: input.practitionerId === undefined ? undefined : input.practitionerId,
        discountCents: input.discountCents,
        ...(input.stagePercents
          ? {
              stage1Percent: input.stagePercents[0],
              stage2Percent: input.stagePercents[1],
              stage3Percent: input.stagePercents[2],
            }
          : {}),
      },
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: "plan.updated",
      recordType: "TreatmentPlan",
      recordId: plan.id,
      previousValue: {
        title: plan.title,
        notes: plan.notes,
        practitionerId: plan.practitionerId,
        discountCents: plan.discountCents,
        stages: [plan.stage1Percent, plan.stage2Percent, plan.stage3Percent],
      },
      newValue: {
        title: updated.title,
        notes: updated.notes,
        practitionerId: updated.practitionerId,
        discountCents: updated.discountCents,
        stages: [updated.stage1Percent, updated.stage2Percent, updated.stage3Percent],
      },
    });
    return updated;
  });
}

export async function addPlanItem(actor: Actor, rawInput: unknown) {
  const input = addPlanItemSchema.parse(rawInput);
  assertCan(actor.role, "treatmentPlans.manage");

  return prisma.$transaction(async (tx) => {
    const plan = await loadPlan(tx, actor.practiceId, input.planId);
    assertEditable(plan.status);
    if (input.catalogItemId) {
      const catalogItem = await tx.treatmentCatalogItem.findFirst({
        where: { id: input.catalogItemId, practiceId: actor.practiceId },
      });
      if (!catalogItem) throw new NotFoundError("Treatment not found");
    }
    const item = await tx.treatmentPlanItem.create({
      data: {
        planId: plan.id,
        catalogItemId: input.catalogItemId ?? null,
        description: input.description,
        teeth: input.teeth ?? null,
        quantity: input.quantity,
        unitPriceCents: input.unitPriceCents,
        sortOrder: plan.items.length,
      },
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: "plan.itemAdded",
      recordType: "TreatmentPlanItem",
      recordId: item.id,
      previousValue: null,
      newValue: serialize(item),
    });
    return item;
  });
}

/** Removing is only possible before acceptance; afterwards an item is cancelled instead, so the record stays. */
export async function removePlanItem(actor: Actor, rawInput: unknown) {
  const input = planItemRefSchema.parse(rawInput);
  assertCan(actor.role, "treatmentPlans.manage");

  return prisma.$transaction(async (tx) => {
    const item = await tx.treatmentPlanItem.findFirst({
      where: { id: input.itemId, plan: { practiceId: actor.practiceId } },
      include: { plan: true },
    });
    if (!item) throw new NotFoundError("Plan item not found");
    assertEditable(item.plan.status);
    await tx.treatmentPlanItem.delete({ where: { id: item.id } });
    await writeAudit(tx, {
      userId: actor.id,
      action: "plan.itemRemoved",
      recordType: "TreatmentPlanItem",
      recordId: item.id,
      previousValue: serialize({ ...item, plan: undefined }),
      newValue: null,
    });
    return { id: item.id };
  });
}

/**
 * Marks a planned item done (or cancels it) on an accepted plan. The first
 * completed item moves the plan to IN_PROGRESS; once nothing is left
 * PLANNED the plan completes itself.
 */
async function settlePlanItem(actor: Actor, rawInput: unknown, outcome: "COMPLETED" | "CANCELLED") {
  const input = planItemRefSchema.parse(rawInput);
  assertCan(actor.role, "treatmentPlans.manage");

  return prisma.$transaction(async (tx) => {
    const item = await tx.treatmentPlanItem.findFirst({
      where: { id: input.itemId, plan: { practiceId: actor.practiceId } },
      include: { plan: { include: { items: true } } },
    });
    if (!item) throw new NotFoundError("Plan item not found");
    if (!ACTIVE_PLAN_STATUSES.includes(item.plan.status)) {
      throw new BusinessRuleError("PLAN_NOT_ACTIVE", "Treatment can only be recorded on an accepted plan.");
    }
    if (item.status !== "PLANNED") throw new InvalidTransitionError(item.status, outcome);

    const now = new Date();
    const updatedItem = await tx.treatmentPlanItem.update({
      where: { id: item.id },
      data: {
        status: outcome,
        completedAt: outcome === "COMPLETED" ? now : null,
        completedById: outcome === "COMPLETED" ? actor.id : null,
      },
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: outcome === "COMPLETED" ? "plan.itemCompleted" : "plan.itemCancelled",
      recordType: "TreatmentPlanItem",
      recordId: item.id,
      previousValue: { status: item.status },
      newValue: { status: outcome },
    });

    const items = item.plan.items.map((i) => (i.id === item.id ? updatedItem : i));
    const anyPlanned = items.some((i) => i.status === "PLANNED");
    const anyCompleted = items.some((i) => i.status === "COMPLETED");
    let nextStatus: TreatmentPlanStatus = item.plan.status;
    if (!anyPlanned && anyCompleted) nextStatus = "COMPLETED";
    else if (anyCompleted) nextStatus = "IN_PROGRESS";

    if (nextStatus !== item.plan.status) {
      await tx.treatmentPlan.update({
        where: { id: item.plan.id },
        data: { status: nextStatus, completedAt: nextStatus === "COMPLETED" ? now : null },
      });
      await writeAudit(tx, {
        userId: actor.id,
        action: "plan.statusChanged",
        recordType: "TreatmentPlan",
        recordId: item.plan.id,
        previousValue: { status: item.plan.status },
        newValue: { status: nextStatus, automatic: true },
      });
      await onPlanStatusChanged(tx, item.plan, nextStatus, actor.id, now);
    }
    return { item: updatedItem, planStatus: nextStatus };
  });
}

export function completePlanItem(actor: Actor, rawInput: unknown) {
  return settlePlanItem(actor, rawInput, "COMPLETED");
}

export function cancelPlanItem(actor: Actor, rawInput: unknown) {
  return settlePlanItem(actor, rawInput, "CANCELLED");
}

const TRANSITIONS: Record<PlanAction, { from: TreatmentPlanStatus[]; to: TreatmentPlanStatus }> = {
  present: { from: ["DRAFT"], to: "PRESENTED" },
  accept: { from: ["DRAFT", "PRESENTED"], to: "ACCEPTED" },
  decline: { from: ["DRAFT", "PRESENTED"], to: "DECLINED" },
  complete: { from: ["ACCEPTED", "IN_PROGRESS"], to: "COMPLETED" },
  cancel: { from: ["DRAFT", "PRESENTED", "ACCEPTED", "IN_PROGRESS"], to: "CANCELLED" },
  reopen: { from: ["DECLINED", "CANCELLED"], to: "PRESENTED" },
};

export async function changePlanStatus(actor: Actor, rawInput: unknown) {
  const input = changePlanStatusSchema.parse(rawInput);
  // Recording the patient's yes/no is a front-desk job (they often call
  // back to agree); everything else is the clinical team's.
  assertCan(
    actor.role,
    input.action === "accept" || input.action === "decline" ? "treatmentPlans.recordDecision" : "treatmentPlans.manage"
  );

  return prisma.$transaction(async (tx) => {
    const plan = await loadPlan(tx, actor.practiceId, input.planId);
    const transition = TRANSITIONS[input.action];
    if (!transition.from.includes(plan.status)) throw new InvalidTransitionError(plan.status, transition.to);

    const liveItems = plan.items.filter((i) => i.status !== "CANCELLED");
    if ((input.action === "present" || input.action === "accept") && liveItems.length === 0) {
      throw new BusinessRuleError("PLAN_EMPTY", "Add at least one treatment before presenting or accepting the plan.");
    }
    if (input.action === "complete" && plan.items.some((i) => i.status === "PLANNED")) {
      throw new BusinessRuleError(
        "PLAN_HAS_OPEN_ITEMS",
        "Mark every treatment as done or cancelled before completing the plan."
      );
    }

    const now = new Date();
    const data: Prisma.TreatmentPlanUpdateInput = { status: transition.to, statusReason: input.reason ?? null };
    if (input.action === "present") data.presentedAt = now;
    if (input.action === "accept") {
      data.acceptedAt = now;
      if (!plan.presentedAt) data.presentedAt = now;
    }
    if (input.action === "decline") data.declinedAt = now;
    if (input.action === "complete") data.completedAt = now;
    if (input.action === "cancel") data.cancelledAt = now;
    if (input.action === "reopen") {
      data.declinedAt = null;
      data.cancelledAt = null;
    }

    const updated = await tx.treatmentPlan.update({ where: { id: plan.id }, data });
    await writeAudit(tx, {
      userId: actor.id,
      action: "plan.statusChanged",
      recordType: "TreatmentPlan",
      recordId: plan.id,
      previousValue: { status: plan.status },
      newValue: { status: transition.to, reason: input.reason ?? null },
    });
    await onPlanStatusChanged(tx, plan, transition.to, actor.id);
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function recordPayment(actor: Actor, rawInput: unknown) {
  const input = recordPaymentSchema.parse(rawInput);
  assertCan(actor.role, "payments.record");
  const amountUsdCents = toUsdCents(input.amount, input.currency, input.exchangeRate);

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({ where: { id: input.patientId, practiceId: actor.practiceId } });
    if (!patient) throw new NotFoundError("Patient not found");

    if (input.planId) {
      const plan = await loadPlan(tx, actor.practiceId, input.planId);
      if (plan.patientId !== patient.id) throw new NotFoundError("Treatment plan not found");
      if (!ACTIVE_PLAN_STATUSES.includes(plan.status) && !(input.kind === "PAYMENT" && plan.status === "COMPLETED")) {
        // AURA policy: the deposit is only taken once the patient has
        // approved the plan and booked the procedure.
        throw new BusinessRuleError(
          "PLAN_NOT_ACCEPTED",
          "Payments can only be taken on a plan the patient has accepted."
        );
      }

      const balance = planBalance({
        items: plan.items,
        discountCents: plan.discountCents,
        status: plan.status,
        payments: plan.payments,
        refunds: plan.refundRequests,
      });
      if (amountUsdCents > balance.balanceCents + OVERPAYMENT_TOLERANCE_CENTS) {
        throw new BusinessRuleError("OVERPAYMENT", "This payment is more than the remaining balance on the plan.");
      }
    }

    const payment = await tx.payment.create({
      data: {
        practiceId: actor.practiceId,
        patientId: patient.id,
        planId: input.planId ?? null,
        receiptNumber: await nextSequence(tx, "receipt"),
        kind: input.kind,
        method: input.method,
        currency: input.currency,
        amount: input.amount,
        exchangeRate: input.currency === "SYP" ? input.exchangeRate! : null,
        amountUsdCents,
        receivedAt: input.receivedAt ?? new Date(),
        note: input.note ?? null,
        receivedById: actor.id,
      },
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: "payment.recorded",
      recordType: "Payment",
      recordId: payment.id,
      previousValue: null,
      newValue: serialize(payment),
    });
    return payment;
  });
}

export async function voidPayment(actor: Actor, rawInput: unknown) {
  const input = voidPaymentSchema.parse(rawInput);
  assertCan(actor.role, "payments.void");

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { id: input.paymentId, practiceId: actor.practiceId } });
    if (!payment) throw new NotFoundError("Payment not found");
    if (payment.voidedAt) throw new BusinessRuleError("ALREADY_VOIDED", "This payment has already been voided.");

    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: { voidedAt: new Date(), voidedById: actor.id, voidReason: input.reason },
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: "payment.voided",
      recordType: "Payment",
      recordId: payment.id,
      previousValue: { voidedAt: null },
      newValue: { voidedAt: updated.voidedAt, reason: input.reason },
    });
    return updated;
  });
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export async function requestRefund(actor: Actor, rawInput: unknown) {
  const input = requestRefundSchema.parse(rawInput);
  assertCan(actor.role, "refunds.request");

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({ where: { id: input.patientId, practiceId: actor.practiceId } });
    if (!patient) throw new NotFoundError("Patient not found");

    // A refund can't exceed what's actually been paid and not yet refunded
    // (or already promised in an open request) — on the plan if one is
    // given, otherwise across the whole patient account.
    const scope = input.planId ? { planId: input.planId } : {};
    const [payments, refunds] = await Promise.all([
      tx.payment.findMany({ where: { patientId: patient.id, voidedAt: null, ...scope } }),
      tx.refundRequest.findMany({ where: { patientId: patient.id, status: { in: ["REQUESTED", "PAID"] }, ...scope } }),
    ]);
    if (input.planId && !(await tx.treatmentPlan.findFirst({ where: { id: input.planId, patientId: patient.id } }))) {
      throw new NotFoundError("Treatment plan not found");
    }
    if (input.paymentId && !payments.some((p) => p.id === input.paymentId)) {
      throw new NotFoundError("Payment not found");
    }
    const refundable =
      payments.reduce((s, p) => s + p.amountUsdCents, 0) - refunds.reduce((s, r) => s + r.amountUsdCents, 0);
    if (input.amountUsdCents > refundable) {
      throw new BusinessRuleError("REFUND_OVER_PAID", "The refund is more than the amount paid.");
    }

    const now = new Date();
    const refund = await tx.refundRequest.create({
      data: {
        practiceId: actor.practiceId,
        patientId: patient.id,
        planId: input.planId ?? null,
        paymentId: input.paymentId ?? null,
        amountUsdCents: input.amountUsdCents,
        channel: input.channel,
        reason: input.reason ?? null,
        requestedAt: now,
        dueBy: refundDueBy(now),
        createdById: actor.id,
      },
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: "refund.requested",
      recordType: "RefundRequest",
      recordId: refund.id,
      previousValue: null,
      newValue: serialize(refund),
    });
    return refund;
  });
}

export async function processRefund(actor: Actor, rawInput: unknown) {
  const input = processRefundSchema.parse(rawInput);
  assertCan(actor.role, "refunds.process");

  return prisma.$transaction(async (tx) => {
    const refund = await tx.refundRequest.findFirst({ where: { id: input.refundId, practiceId: actor.practiceId } });
    if (!refund) throw new NotFoundError("Refund request not found");
    if (refund.status !== "REQUESTED") throw new InvalidTransitionError(refund.status, input.outcome);

    const updated = await tx.refundRequest.update({
      where: { id: refund.id },
      data: {
        status: input.outcome,
        processedAt: new Date(),
        processedById: actor.id,
        method: input.outcome === "PAID" ? input.method : null,
        processNote: input.note ?? null,
      },
    });
    await writeAudit(tx, {
      userId: actor.id,
      action: input.outcome === "PAID" ? "refund.paid" : "refund.rejected",
      recordType: "RefundRequest",
      recordId: refund.id,
      previousValue: { status: refund.status },
      newValue: { status: input.outcome, method: updated.method, note: updated.processNote },
    });
    return updated;
  });
}
