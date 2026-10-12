import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb, seedFixture } from "./fixtures";
import {
  addPlanItem,
  cancelPlanItem,
  changePlanStatus,
  completePlanItem,
  createCatalogItem,
  createPlan,
  processRefund,
  recordPayment,
  removePlanItem,
  requestRefund,
  updatePlan,
  voidPayment,
} from "@/lib/services/billing-service";
import { getPatientAccount, getPatientPlans } from "@/lib/services/billing-queries";
import { addWorkingDays, stageBreakdown, toUsdCents } from "@/lib/billing/money";
import { PermissionError } from "@/lib/permissions";
import { BusinessRuleError, InvalidTransitionError } from "@/lib/services/errors";

async function fixture() {
  await resetDb();
  return seedFixture();
}

/** A $1,000 plan (2 × $500) accepted by the patient — the starting point for most money tests. */
async function acceptedPlan() {
  const f = await fixture();
  const plan = await createPlan(f.actors.clinicianA, { patientId: f.patient1.id, title: "Implants" });
  await addPlanItem(f.actors.clinicianA, {
    planId: plan.id,
    description: "Implant",
    quantity: 2,
    unitPriceCents: 50_000,
  });
  await changePlanStatus(f.actors.clinicianA, { planId: plan.id, action: "present" });
  await changePlanStatus(f.actors.reception, { planId: plan.id, action: "accept" });
  return { ...f, plan };
}

function ruleCode(code: string) {
  return expect.objectContaining({ name: "BusinessRuleError", code });
}

describe("billing arithmetic", () => {
  it("splits 50/30/20 and allocates payments stage by stage", () => {
    const stages = stageBreakdown(100_000, [50, 30, 20], 60_000);
    expect(stages.map((s) => s.dueCents)).toEqual([50_000, 30_000, 20_000]);
    expect(stages.map((s) => s.paidCents)).toEqual([50_000, 10_000, 0]);
    expect(stages.map((s) => s.remainingCents)).toEqual([0, 20_000, 20_000]);
  });

  it("puts rounding into the last stage so stages always sum to the total", () => {
    const stages = stageBreakdown(33_333, [50, 30, 20], 0);
    expect(stages.reduce((s, x) => s + x.dueCents, 0)).toBe(33_333);
  });

  it("converts SYP to USD cents with the given rate", () => {
    expect(toUsdCents(1_300_000, "SYP", 13_000)).toBe(10_000);
    expect(() => toUsdCents(1_000, "SYP", null)).toThrow();
  });

  it("skips Fridays when counting refund working days", () => {
    // Wednesday 2026-10-14 + 3 working days = Thu, Sat, Sun -> Sunday 18th.
    const due = addWorkingDays(new Date(2026, 9, 14, 12), 3);
    expect(due.getDate()).toBe(18);
  });
});

describe("treatment plans", () => {
  it("lets a clinician build a plan with a sequential plan number", async () => {
    const { actors, patient1 } = await fixture();
    const a = await createPlan(actors.clinicianA, { patientId: patient1.id, title: "Plan A" });
    const b = await createPlan(actors.clinicianA, { patientId: patient1.id, title: "Plan B" });
    expect(a.planNumber).toBe("TP-000001");
    expect(b.planNumber).toBe("TP-000002");
    expect(a.practitionerId).toBe(actors.clinicianA.practitionerId);
    expect(a.status).toBe("DRAFT");
  });

  it("blocks reception from building plans but lets them record the patient's decision", async () => {
    const { actors, patient1 } = await fixture();
    await expect(createPlan(actors.reception, { patientId: patient1.id, title: "X" })).rejects.toBeInstanceOf(
      PermissionError
    );
    const plan = await createPlan(actors.clinicianA, { patientId: patient1.id, title: "X" });
    await addPlanItem(actors.clinicianA, { planId: plan.id, description: "Crown", quantity: 1, unitPriceCents: 4000 });
    const accepted = await changePlanStatus(actors.reception, { planId: plan.id, action: "accept" });
    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.presentedAt).not.toBeNull();
  });

  it("won't present an empty plan", async () => {
    const { actors, patient1 } = await fixture();
    const plan = await createPlan(actors.clinicianA, { patientId: patient1.id, title: "Empty" });
    await expect(changePlanStatus(actors.clinicianA, { planId: plan.id, action: "present" })).rejects.toEqual(
      ruleCode("PLAN_EMPTY")
    );
  });

  it("freezes items and discount once the plan is accepted", async () => {
    const { actors, plan } = await acceptedPlan();
    await expect(
      addPlanItem(actors.clinicianA, { planId: plan.id, description: "Extra", quantity: 1, unitPriceCents: 100 })
    ).rejects.toEqual(ruleCode("PLAN_LOCKED"));
    await expect(updatePlan(actors.clinicianA, { planId: plan.id, discountCents: 100 })).rejects.toEqual(
      ruleCode("PLAN_LOCKED")
    );
    const [item] = (await getPatientPlans(actors.admin.practiceId, plan.patientId))[0].items;
    await expect(removePlanItem(actors.clinicianA, { itemId: item.id })).rejects.toEqual(ruleCode("PLAN_LOCKED"));
    // Notes can still change.
    const updated = await updatePlan(actors.clinicianA, { planId: plan.id, notes: "Patient prefers mornings" });
    expect(updated.notes).toBe("Patient prefers mornings");
  });

  it("rejects stage percentages that don't add up to 100", async () => {
    const { actors, patient1 } = await fixture();
    const plan = await createPlan(actors.clinicianA, { patientId: patient1.id, title: "X" });
    await expect(updatePlan(actors.clinicianA, { planId: plan.id, stagePercents: [50, 30, 10] })).rejects.toThrow();
    const ok = await updatePlan(actors.clinicianA, { planId: plan.id, stagePercents: [40, 40, 20] });
    expect([ok.stage1Percent, ok.stage2Percent, ok.stage3Percent]).toEqual([40, 40, 20]);
  });

  it("moves to IN_PROGRESS on the first completed item and completes itself when nothing is left", async () => {
    const { actors, patient1 } = await fixture();
    const plan = await createPlan(actors.clinicianA, { patientId: patient1.id, title: "Two steps" });
    const a = await addPlanItem(actors.clinicianA, { planId: plan.id, description: "A", quantity: 1, unitPriceCents: 100 });
    const b = await addPlanItem(actors.clinicianA, { planId: plan.id, description: "B", quantity: 1, unitPriceCents: 100 });
    await changePlanStatus(actors.clinicianA, { planId: plan.id, action: "accept" });

    const first = await completePlanItem(actors.clinicianA, { itemId: a.id });
    expect(first.planStatus).toBe("IN_PROGRESS");
    await expect(completePlanItem(actors.clinicianA, { itemId: a.id })).rejects.toBeInstanceOf(InvalidTransitionError);

    const last = await cancelPlanItem(actors.clinicianA, { itemId: b.id });
    expect(last.planStatus).toBe("COMPLETED");
    const stored = await prisma.treatmentPlan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(stored.completedAt).not.toBeNull();
  });

  it("can reopen a declined plan", async () => {
    const { actors, patient1 } = await fixture();
    const plan = await createPlan(actors.clinicianA, { patientId: patient1.id, title: "X" });
    await addPlanItem(actors.clinicianA, { planId: plan.id, description: "A", quantity: 1, unitPriceCents: 100 });
    await changePlanStatus(actors.reception, { planId: plan.id, action: "decline", reason: "Price" });
    const reopened = await changePlanStatus(actors.clinicianA, { planId: plan.id, action: "reopen" });
    expect(reopened.status).toBe("PRESENTED");
    expect(reopened.declinedAt).toBeNull();
  });

  it("audits every plan mutation", async () => {
    const { plan } = await acceptedPlan();
    const actions = (await prisma.auditLog.findMany({ where: { recordId: plan.id } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["plan.created", "plan.statusChanged"]));
  });
});

describe("payments", () => {
  it("refuses a deposit before the patient has accepted the plan", async () => {
    const { actors, patient1 } = await fixture();
    const plan = await createPlan(actors.clinicianA, { patientId: patient1.id, title: "X" });
    await addPlanItem(actors.clinicianA, { planId: plan.id, description: "A", quantity: 1, unitPriceCents: 100_000 });
    await expect(
      recordPayment(actors.reception, {
        patientId: patient1.id,
        planId: plan.id,
        kind: "DEPOSIT",
        method: "CASH",
        currency: "USD",
        amount: 2_000,
      })
    ).rejects.toEqual(ruleCode("PLAN_NOT_ACCEPTED"));
  });

  it("caps the deposit at 5% of the plan total", async () => {
    const { actors, patient1, plan } = await acceptedPlan();
    const base = { patientId: patient1.id, planId: plan.id, kind: "DEPOSIT", method: "CASH", currency: "USD" } as const;
    await recordPayment(actors.reception, { ...base, amount: 3_000 });
    // $30 already taken; another $25 would make $55 > $50 (5% of $1,000).
    await expect(recordPayment(actors.reception, { ...base, amount: 2_500 })).rejects.toEqual(
      ruleCode("DEPOSIT_OVER_LIMIT")
    );
    await recordPayment(actors.reception, { ...base, amount: 2_000 });
  });

  it("stops a clinician taking money and blocks overpayment", async () => {
    const { actors, patient1, plan } = await acceptedPlan();
    const base = { patientId: patient1.id, planId: plan.id, kind: "PAYMENT", method: "CASH", currency: "USD" } as const;
    await expect(recordPayment(actors.clinicianA, { ...base, amount: 100 })).rejects.toBeInstanceOf(PermissionError);
    await expect(recordPayment(actors.reception, { ...base, amount: 100_001 + 100 })).rejects.toEqual(
      ruleCode("OVERPAYMENT")
    );
  });

  it("records SYP payments with their USD equivalent and numbers receipts sequentially", async () => {
    const { actors, patient1, plan } = await acceptedPlan();
    const p1 = await recordPayment(actors.reception, {
      patientId: patient1.id,
      planId: plan.id,
      kind: "PAYMENT",
      method: "SHAM_CASH",
      currency: "SYP",
      amount: 6_500_000,
      exchangeRate: 13_000,
    });
    expect(p1.amountUsdCents).toBe(50_000);
    expect(p1.receiptNumber).toBe("R-000001");
    const p2 = await recordPayment(actors.reception, {
      patientId: patient1.id,
      planId: plan.id,
      kind: "PAYMENT",
      method: "CASH",
      currency: "USD",
      amount: 10_000,
    });
    expect(p2.receiptNumber).toBe("R-000002");

    const [withMoney] = await getPatientPlans(actors.admin.practiceId, patient1.id);
    expect(withMoney.balance.balanceCents).toBe(40_000);
    expect(withMoney.stages.map((s) => s.remainingCents)).toEqual([0, 20_000, 20_000]);
  });

  it("requires an exchange rate for SYP", async () => {
    const { actors, patient1 } = await fixture();
    await expect(
      recordPayment(actors.reception, { patientId: patient1.id, kind: "PAYMENT", method: "CASH", currency: "SYP", amount: 1000 })
    ).rejects.toThrow();
  });

  it("only lets a manager void, and a voided payment no longer counts", async () => {
    const { actors, patient1, plan } = await acceptedPlan();
    const payment = await recordPayment(actors.reception, {
      patientId: patient1.id,
      planId: plan.id,
      kind: "PAYMENT",
      method: "CASH",
      currency: "USD",
      amount: 20_000,
    });
    await expect(voidPayment(actors.reception, { paymentId: payment.id, reason: "typo" })).rejects.toBeInstanceOf(
      PermissionError
    );
    await voidPayment(actors.manager, { paymentId: payment.id, reason: "typo" });
    await expect(voidPayment(actors.manager, { paymentId: payment.id, reason: "again" })).rejects.toBeInstanceOf(
      BusinessRuleError
    );
    const account = await getPatientAccount(actors.admin.practiceId, patient1.id);
    expect(account.summary.paidCents).toBe(0);
    expect(account.summary.balanceCents).toBe(100_000);
  });
});

describe("refunds", () => {
  it("can't refund more than was paid, including open requests", async () => {
    const { actors, patient1, plan } = await acceptedPlan();
    await recordPayment(actors.reception, {
      patientId: patient1.id,
      planId: plan.id,
      kind: "DEPOSIT",
      method: "CASH",
      currency: "USD",
      amount: 5_000,
    });
    await requestRefund(actors.reception, { patientId: patient1.id, planId: plan.id, amountUsdCents: 3_000, channel: "ELECTRONIC" });
    await expect(
      requestRefund(actors.reception, { patientId: patient1.id, planId: plan.id, amountUsdCents: 2_500, channel: "IN_PERSON" })
    ).rejects.toEqual(ruleCode("REFUND_OVER_PAID"));
  });

  it("sets a due date and only lets a manager pay it out", async () => {
    const { actors, patient1, plan } = await acceptedPlan();
    await recordPayment(actors.reception, {
      patientId: patient1.id,
      planId: plan.id,
      kind: "DEPOSIT",
      method: "CASH",
      currency: "USD",
      amount: 5_000,
    });
    const refund = await requestRefund(actors.reception, {
      patientId: patient1.id,
      planId: plan.id,
      amountUsdCents: 5_000,
      channel: "ELECTRONIC",
      reason: "Changed mind",
    });
    expect(refund.dueBy.getTime()).toBeGreaterThan(refund.requestedAt.getTime());
    await expect(
      processRefund(actors.reception, { refundId: refund.id, outcome: "PAID", method: "SHAM_CASH" })
    ).rejects.toBeInstanceOf(PermissionError);
    await expect(processRefund(actors.manager, { refundId: refund.id, outcome: "PAID" })).rejects.toThrow();
    await processRefund(actors.manager, { refundId: refund.id, outcome: "PAID", method: "SHAM_CASH" });

    const account = await getPatientAccount(actors.admin.practiceId, patient1.id);
    expect(account.summary.refundedCents).toBe(5_000);
    expect(account.summary.balanceCents).toBe(100_000);
  });
});

describe("price list", () => {
  it("is managed from settings only and rejects duplicate codes", async () => {
    const { actors } = await fixture();
    const input = { code: "IMPLANT_ROOT", nameEn: "Root implant", nameAr: "زرعة Root", category: "Implants", priceCents: 20_000 };
    await expect(createCatalogItem(actors.reception, input)).rejects.toBeInstanceOf(PermissionError);
    await createCatalogItem(actors.admin, input);
    await expect(createCatalogItem(actors.admin, input)).rejects.toEqual(ruleCode("DUPLICATE_CODE"));
  });
});
