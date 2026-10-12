import { z } from "zod";

const cents = z.number().int().min(0).max(100_000_000);
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();

// --- Price list -----------------------------------------------------------

export const createCatalogItemSchema = z.object({
  code: z.string().trim().min(1).max(40).regex(/^[A-Z0-9_]+$/),
  nameEn: z.string().trim().min(1).max(150),
  nameAr: z.string().trim().min(1).max(150),
  category: z.string().trim().min(1).max(60),
  priceCents: cents,
  priceNote: optionalText(200),
});

export const updateCatalogItemSchema = z.object({
  catalogItemId: z.string().min(1),
  nameEn: z.string().trim().min(1).max(150).optional(),
  nameAr: z.string().trim().min(1).max(150).optional(),
  category: z.string().trim().min(1).max(60).optional(),
  priceCents: cents.optional(),
  priceNote: optionalText(200),
  active: z.boolean().optional(),
});

// --- Treatment plans ------------------------------------------------------

export const createPlanSchema = z.object({
  patientId: z.string().min(1),
  title: z.string().trim().min(1).max(150),
  practitionerId: z.string().min(1).optional().nullable(),
  notes: optionalText(4000),
});

export const updatePlanSchema = z
  .object({
    planId: z.string().min(1),
    title: z.string().trim().min(1).max(150).optional(),
    practitionerId: z.string().min(1).optional().nullable(),
    notes: optionalText(4000),
    discountCents: cents.optional(),
    stagePercents: z.tuple([z.number().int().min(0).max(100), z.number().int().min(0).max(100), z.number().int().min(0).max(100)]).optional(),
  })
  .refine((v) => !v.stagePercents || v.stagePercents[0] + v.stagePercents[1] + v.stagePercents[2] === 100, {
    message: "Stage percentages must add up to 100.",
    path: ["stagePercents"],
  });

export const addPlanItemSchema = z.object({
  planId: z.string().min(1),
  catalogItemId: z.string().min(1).optional().nullable(),
  description: z.string().trim().min(1).max(200),
  teeth: optionalText(100),
  quantity: z.number().int().min(1).max(64),
  unitPriceCents: cents,
});

export const planItemRefSchema = z.object({ itemId: z.string().min(1) });

export const PLAN_ACTIONS = ["present", "accept", "decline", "complete", "cancel", "reopen"] as const;
export type PlanAction = (typeof PLAN_ACTIONS)[number];

export const changePlanStatusSchema = z.object({
  planId: z.string().min(1),
  action: z.enum(PLAN_ACTIONS),
  reason: optionalText(1000),
});

export const planListFilterSchema = z.object({
  status: z.enum(["DRAFT", "PRESENTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "DECLINED", "CANCELLED"]).optional(),
});

// --- Payments & refunds ---------------------------------------------------

export const recordPaymentSchema = z
  .object({
    patientId: z.string().min(1),
    planId: z.string().min(1).optional().nullable(),
    kind: z.enum(["DEPOSIT", "PAYMENT"]),
    method: z.enum(["CASH", "SHAM_CASH", "BANK_TRANSFER", "OTHER"]),
    currency: z.enum(["USD", "SYP"]),
    amount: z.number().int().min(1).max(100_000_000_000),
    exchangeRate: z.number().int().min(1).max(10_000_000).optional().nullable(),
    receivedAt: z.coerce.date().optional(),
    note: optionalText(1000),
  })
  .refine((v) => v.currency === "USD" || !!v.exchangeRate, {
    message: "An exchange rate is required for SYP payments.",
    path: ["exchangeRate"],
  })
  .refine((v) => v.kind !== "DEPOSIT" || !!v.planId, {
    message: "A deposit must be linked to a treatment plan.",
    path: ["planId"],
  });

export const voidPaymentSchema = z.object({
  paymentId: z.string().min(1),
  reason: z.string().trim().min(1).max(1000),
});

export const requestRefundSchema = z.object({
  patientId: z.string().min(1),
  planId: z.string().min(1).optional().nullable(),
  paymentId: z.string().min(1).optional().nullable(),
  amountUsdCents: z.number().int().min(1).max(100_000_000),
  channel: z.enum(["ELECTRONIC", "IN_PERSON"]),
  reason: optionalText(1000),
});

export const processRefundSchema = z
  .object({
    refundId: z.string().min(1),
    outcome: z.enum(["PAID", "REJECTED"]),
    method: z.enum(["CASH", "SHAM_CASH", "BANK_TRANSFER", "OTHER"]).optional().nullable(),
    note: optionalText(1000),
  })
  .refine((v) => v.outcome !== "PAID" || !!v.method, {
    message: "Choose how the refund was paid.",
    path: ["method"],
  });
