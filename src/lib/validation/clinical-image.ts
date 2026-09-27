import { z } from "zod";
import { CLINICAL_IMAGE_CATEGORIES } from "@/lib/dental/chart-item-catalog";
import { isValidToothNumber } from "@/lib/dental/teeth";

export const uploadClinicalImageMetaSchema = z.object({
  patientId: z.string().min(1),
  filename: z.string().min(1),
  category: z.enum(CLINICAL_IMAGE_CATEGORIES).default("OTHER"),
  toothNumber: z
    .string()
    .refine(isValidToothNumber, { message: "Not a valid FDI tooth number." })
    .optional()
    .nullable(),
  chartEntryId: z.string().min(1).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  capturedDate: z.coerce.date().optional(),
});

export const deleteClinicalImageSchema = z.object({
  imageId: z.string().min(1),
});
