import type { Prisma, TreatmentPlanStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { planBalance, stageBreakdown, type PlanBalance, type StageBreakdown } from "@/lib/billing/money";
import { planListFilterSchema } from "@/lib/validation/billing";

// The one place the TreatmentPlan relation shape is defined, reused by the
// patient tab, the practice-wide list and the print view.
export const PLAN_INCLUDE = {
  practitioner: { select: { name: true } },
  createdBy: { select: { name: true } },
  items: { orderBy: { sortOrder: "asc" } },
  payments: { select: { amountUsdCents: true, voidedAt: true, kind: true } },
  refundRequests: { select: { amountUsdCents: true, status: true } },
} satisfies Prisma.TreatmentPlanInclude;

type PlanRow = Prisma.TreatmentPlanGetPayload<{ include: typeof PLAN_INCLUDE }>;

export type PlanWithMoney = Omit<PlanRow, "payments" | "refundRequests"> & {
  balance: PlanBalance;
  stages: StageBreakdown[];
  depositCents: number;
};

function withMoney(plan: PlanRow): PlanWithMoney {
  const balance = planBalance({
    items: plan.items,
    discountCents: plan.discountCents,
    status: plan.status,
    payments: plan.payments,
    refunds: plan.refundRequests,
  });
  const { payments, ...rest } = plan;
  delete (rest as Partial<PlanRow>).refundRequests;
  return {
    ...rest,
    balance,
    stages: stageBreakdown(
      balance.totalCents,
      [plan.stage1Percent, plan.stage2Percent, plan.stage3Percent],
      balance.netPaidCents
    ),
    depositCents: payments.filter((p) => p.kind === "DEPOSIT" && !p.voidedAt).reduce((s, p) => s + p.amountUsdCents, 0),
  };
}

export async function getPatientPlans(practiceId: string, patientId: string): Promise<PlanWithMoney[]> {
  const plans = await prisma.treatmentPlan.findMany({
    where: { practiceId, patientId },
    include: PLAN_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return plans.map(withMoney);
}

export async function getPlanForPrint(practiceId: string, planId: string) {
  const plan = await prisma.treatmentPlan.findFirst({
    where: { id: planId, practiceId },
    include: {
      ...PLAN_INCLUDE,
      patient: { select: { firstName: true, lastName: true, patientCode: true, phone: true, dateOfBirth: true } },
      practice: { select: { name: true } },
    },
  });
  if (!plan) return null;
  const { patient, practice, ...row } = plan;
  return { plan: withMoney(row), patient, practice };
}

export async function listPlans(practiceId: string, rawFilters: unknown = {}) {
  const filters = planListFilterSchema.parse(rawFilters);
  const plans = await prisma.treatmentPlan.findMany({
    where: { practiceId, ...(filters.status ? { status: filters.status } : {}) },
    include: {
      ...PLAN_INCLUDE,
      patient: { select: { id: true, firstName: true, lastName: true, patientCode: true, phone: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return plans.map(({ patient, ...row }) => ({ ...withMoney(row), patient }));
}

export async function countPlansByStatus(practiceId: string) {
  const groups = await prisma.treatmentPlan.groupBy({
    by: ["status"],
    where: { practiceId },
    _count: { _all: true },
  });
  return Object.fromEntries(groups.map((g) => [g.status, g._count._all])) as Partial<Record<TreatmentPlanStatus, number>>;
}

export async function getPatientAccount(practiceId: string, patientId: string) {
  const [plans, payments, refunds] = await Promise.all([
    getPatientPlans(practiceId, patientId),
    prisma.payment.findMany({
      where: { practiceId, patientId },
      include: {
        plan: { select: { planNumber: true, title: true } },
        receivedBy: { select: { name: true } },
        voidedBy: { select: { name: true } },
      },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.refundRequest.findMany({
      where: { practiceId, patientId },
      include: {
        plan: { select: { planNumber: true, title: true } },
        createdBy: { select: { name: true } },
        processedBy: { select: { name: true } },
      },
      orderBy: { requestedAt: "desc" },
    }),
  ]);

  const paidCents = payments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amountUsdCents, 0);
  const refundedCents = refunds.filter((r) => r.status === "PAID").reduce((s, r) => s + r.amountUsdCents, 0);
  const billedCents = plans
    .filter((p) => p.status === "ACCEPTED" || p.status === "IN_PROGRESS" || p.status === "COMPLETED")
    .reduce((s, p) => s + p.balance.totalCents, 0);

  // Overdue is decided on the server so every viewer sees the same answer.
  const now = new Date();
  return {
    plans,
    payments,
    refunds: refunds.map((r) => ({ ...r, overdue: r.status === "REQUESTED" && r.dueBy < now })),
    summary: {
      billedCents,
      paidCents,
      refundedCents,
      balanceCents: billedCents - (paidCents - refundedCents),
      pendingRefundCents: refunds.filter((r) => r.status === "REQUESTED").reduce((s, r) => s + r.amountUsdCents, 0),
    },
  };
}

export async function getPaymentForReceipt(practiceId: string, paymentId: string) {
  return prisma.payment.findFirst({
    where: { id: paymentId, practiceId },
    include: {
      patient: { select: { firstName: true, lastName: true, patientCode: true, phone: true } },
      plan: { select: { planNumber: true, title: true } },
      receivedBy: { select: { name: true } },
      practice: { select: { name: true } },
    },
  });
}

export async function listCatalogItems(practiceId: string, opts: { activeOnly?: boolean } = {}) {
  return prisma.treatmentCatalogItem.findMany({
    where: { practiceId, ...(opts.activeOnly ? { active: true } : {}) },
    orderBy: [{ sortOrder: "asc" }],
  });
}
