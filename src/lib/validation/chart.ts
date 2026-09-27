import { z } from "zod";
import { CHART_ENTRY_STATUSES, CHART_ITEM_CODES, TOOTH_SURFACES } from "@/lib/dental/chart-item-catalog";
import { isValidToothNumber } from "@/lib/dental/teeth";

const toothNumberSchema = z.string().refine(isValidToothNumber, { message: "Not a valid FDI tooth number." });

export const createChartEntrySchema = z.object({
  patientId: z.string().min(1),
  toothNumber: toothNumberSchema,
  surface: z.enum(TOOTH_SURFACES).optional().nullable(),
  itemCode: z.enum(CHART_ITEM_CODES),
  status: z.enum(CHART_ENTRY_STATUSES).default("EXISTING"),
  recordedDate: z.coerce.date().optional(),
  practitionerId: z.string().min(1).optional().nullable(),
  appointmentId: z.string().min(1).optional().nullable(),
  note: z.string().max(4000).optional().nullable(),
});
export type CreateChartEntryInput = z.infer<typeof createChartEntrySchema>;

export const completeChartEntrySchema = z.object({
  chartEntryId: z.string().min(1),
  completedDate: z.coerce.date().optional(),
  note: z.string().max(4000).optional().nullable(),
});

export const retractChartEntrySchema = z.object({
  chartEntryId: z.string().min(1),
  reason: z.string().max(4000).optional().nullable(),
});

export const chartHistoryFilterSchema = z.object({
  toothNumber: z.string().optional(),
  practitionerId: z.string().optional(),
  itemCode: z.enum(CHART_ITEM_CODES).optional(),
  status: z.enum(CHART_ENTRY_STATUSES).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
